import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../../prisma/prisma.service";
import {
  ANY_PERMISSION_METADATA_KEY,
  OWN_OR_ANY_METADATA_KEY,
  PERMISSIONS_METADATA_KEY,
  type OwnOrAnyRequirement,
} from "../decorators/require-permissions.decorator";
import {
  SYSTEM_ROLE_DEFAULTS,
  type PermissionKey,
  type SystemRoleName,
} from "../../modules/identity/roles/permission-catalog";

type AuthedRequest = {
  user?: { id?: string };
  tenantId?: string;
  /** Effective permission keys, set by this guard for handlers to reuse. */
  permissions?: PermissionKey[];
  params?: Record<string, string>;
  query?: Record<string, string | string[]>;
  body?: Record<string, unknown>;
};

/**
 * Resolve a caller's effective permission set for a tenant:
 * Membership → Role → RolePermission rows. Deny by default — no
 * membership, no role, or no grant rows means an empty set.
 *
 * Legacy fallback (schema comment on Membership.role): when a membership
 * has no `roleId` yet, resolve from the legacy `MemberRole` enum via the
 * seeded system Role of the same name; if that role was never seeded,
 * fall back to the hardcoded §2.1 defaults. New code must set `roleId`
 * and never read the legacy enum directly.
 */
export async function loadEffectivePermissions(
  prisma: PrismaService,
  tenantId: string,
  userId: string,
): Promise<PermissionKey[]> {
  const membership = await prisma.membership.findFirst({
    where: { tenantId, userId },
    select: { roleId: true, role: true },
  });
  if (!membership) return [];

  if (membership.roleId) {
    const grants = await prisma.rolePermission.findMany({
      where: { roleId: membership.roleId },
      select: { permissionKey: true },
    });
    return [...new Set(grants.map((g) => g.permissionKey as unknown as PermissionKey))];
  }

  // Legacy fallback: no roleId yet.
  const legacyName = membership.role as unknown as SystemRoleName;
  const systemRole = await prisma.role.findFirst({
    where: { tenantId, name: legacyName, isSystem: true },
    select: { id: true },
  });
  if (systemRole) {
    const grants = await prisma.rolePermission.findMany({
      where: { roleId: systemRole.id },
      select: { permissionKey: true },
    });
    return [...new Set(grants.map((g) => g.permissionKey as unknown as PermissionKey))];
  }
  return [...(SYSTEM_ROLE_DEFAULTS[legacyName] ?? [])];
}

/**
 * Pure own-vs-any check for services that resolve ownership from the
 * database (e.g. a ticket's assignee/author). The guard can only see
 * the request; a service that has loaded the resource calls this after
 * loading it. `ownerId` is the user id the resource belongs to.
 */
export function hasOwnOrAny(
  permissions: PermissionKey[],
  requirement: { own: PermissionKey; any: PermissionKey },
  ownerId: string | undefined,
  userId: string,
): boolean {
  if (permissions.includes(requirement.any)) return true;
  if (permissions.includes(requirement.own) && ownerId !== undefined && ownerId === userId) {
    return true;
  }
  return false;
}

/**
 * PermissionsGuard — the enforcement point for decision 21.
 *
 * Server-side only, on every mutation (and on reads that expose
 * workspace-wide data). Hiding a button in the UI is cosmetic; this
 * guard is what actually denies. It runs after JwtAuthGuard, which
 * sets `req.user.id` and `req.tenantId`.
 *
 * Rules:
 * - No `@RequirePermissions` / `@RequireAnyPermission` /
 *   `@RequireOwnOrAny` metadata on the handler (or its class) → the
 *   guard allows the request (the route is intentionally open to any
 *   authenticated workspace member). "Deny by default" applies to
 *   permission checks: any declared requirement with no matching grant
 *   is denied.
 * - `@RequirePermissions(...)` → caller must hold ALL listed keys.
 * - `@RequireAnyPermission(...)` → caller must hold at least one.
 * - `@RequireOwnOrAny({ own, any, owner })` → `any` passes outright;
 *   `own` passes only when `owner(req)` is the caller.
 * - All declared requirements must pass.
 * - The resolved set is attached to the request as `req.permissions`
 *   so handlers/services can reuse it without a second lookup.
 *
 * Register per-controller (`@UseGuards(JwtAuthGuard, PermissionsGuard)`)
 * or globally via `APP_GUARD` — see the wiring note in roles.module.ts.
 * The worker acts with the system identity of the rule's workspace,
 * never with a user's permissions, so it must NOT use this guard.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required =
      this.reflector.getAllAndOverride<PermissionKey[]>(PERMISSIONS_METADATA_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) ?? [];
    const anyOf =
      this.reflector.getAllAndOverride<PermissionKey[]>(ANY_PERMISSION_METADATA_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) ?? [];
    const ownOrAny = this.reflector.getAllAndOverride<OwnOrAnyRequirement>(
      OWN_OR_ANY_METADATA_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );

    if (required.length === 0 && anyOf.length === 0 && !ownOrAny) {
      return true;
    }

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException("Authenticated user required");
    }
    const tenantId = req.tenantId ?? "demo-tenant";

    const permissions = await loadEffectivePermissions(this.prisma, tenantId, userId);
    req.permissions = permissions;

    const missing = required.filter((k) => !permissions.includes(k));
    if (missing.length > 0) {
      throw new ForbiddenException(`Missing required permission(s): ${missing.join(", ")}`);
    }
    if (anyOf.length > 0 && !anyOf.some((k) => permissions.includes(k))) {
      throw new ForbiddenException(`Requires one of: ${anyOf.join(", ")}`);
    }
    if (ownOrAny) {
      if (!hasOwnOrAny(permissions, ownOrAny, ownOrAny.owner(req), userId)) {
        throw new ForbiddenException(`Requires ${ownOrAny.any} (any) or ${ownOrAny.own} (own)`);
      }
    }
    return true;
  }
}
