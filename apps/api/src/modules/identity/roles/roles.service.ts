import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { PermissionKey as PrismaPermissionKey, Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { loadEffectivePermissions } from "../../../common/guards/permissions.guard";
import {
  ALL_PERMISSION_KEYS,
  SYSTEM_ROLE_DEFAULTS,
  SYSTEM_ROLE_NAMES,
  groupedPermissionCatalog,
  isPermissionKey,
  type PermissionKey,
} from "./permission-catalog";

export interface CreateRoleInput {
  name: string;
  description?: string;
  colour?: string;
  /** Initial grants; defaults to none (an empty custom role). */
  permissions?: PermissionKey[];
}

export interface UpdateRoleInput {
  name?: string;
  description?: string | null;
  colour?: string | null;
}

const roleWithGrants = {
  include: {
    permissions: { select: { permissionKey: true } },
    _count: { select: { memberships: true } },
  },
} as const;

function toPermissionKeys(rows: { permissionKey: unknown }[]): PermissionKey[] {
  return rows.map((r) => r.permissionKey as unknown as PermissionKey);
}

function toPrismaKeys(keys: PermissionKey[]): PrismaPermissionKey[] {
  return keys as unknown as PrismaPermissionKey[];
}

/**
 * Seed the five system roles for a workspace, with the §2.1 defaults.
 *
 * CALL THIS in the workspace-creation transaction (5 roles + their
 * grants), so a workspace never exists without its roles. It is
 * idempotent and safe to re-run: a system role that already exists is
 * left completely untouched — its grants are NOT reset — so re-running
 * can never wipe a workspace admin's edits. There is currently NO
 * workspace-creation endpoint in the API (organisations are only
 * created in `apps/api/prisma/seed.ts`); until one lands, call this
 * from the seed script for the demo org and from the creation path
 * when it is built. See the wiring note in roles.module.ts.
 */
export async function seedSystemRoles(prisma: PrismaService, tenantId: string): Promise<void> {
  for (const name of SYSTEM_ROLE_NAMES) {
    const existing = await prisma.role.findFirst({
      where: { tenantId, name, isSystem: true },
      select: { id: true },
    });
    if (existing) continue;
    await prisma.role.create({
      data: {
        tenantId,
        name,
        description: `System role — seeded defaults, editable by the workspace admin.`,
        isSystem: true,
        permissions: {
          create: toPrismaKeys(SYSTEM_ROLE_DEFAULTS[name]).map((permissionKey) => ({
            permissionKey,
          })),
        },
      },
    });
  }
}

/**
 * Roles — custom roles with custom permissions (decision 21).
 * Every method is tenant-scoped: a role name is unique per tenant, and
 * a role from another workspace is never visible or mutable here.
 * Enforcement (who may call) lives in the controller via
 * PermissionsGuard + @RequirePermissions; this service assumes the
 * caller is already authorised and focuses on tenant scoping, the
 * delete-refused-when-in-use rule, and the audit trail.
 */
@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  /** The fixed 42-key catalog, grouped by area — for the Roles matrix UI. */
  listPermissionCatalog() {
    return { areas: groupedPermissionCatalog(), total: ALL_PERMISSION_KEYS.length };
  }

  listRoles(tenantId: string) {
    return this.prisma.role
      .findMany({
        where: { tenantId },
        ...roleWithGrants,
        orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      })
      .then((roles) =>
        roles.map((r) => ({
          id: r.id,
          tenantId: r.tenantId,
          name: r.name,
          description: r.description,
          colour: r.colour,
          isSystem: r.isSystem,
          memberCount: r._count.memberships,
          permissions: toPermissionKeys(r.permissions),
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })),
      );
  }

  async getRole(tenantId: string, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, tenantId },
      ...roleWithGrants,
    });
    if (!role) throw new NotFoundException("Role not found in this workspace");
    const { _count, permissions, ...rest } = role;
    return {
      ...rest,
      memberCount: _count.memberships,
      permissions: toPermissionKeys(permissions),
    };
  }

  async createRole(tenantId: string, userId: string, input: CreateRoleInput) {
    const permissions = this.validateKeys(input.permissions ?? []);
    const duplicate = await this.prisma.role.findFirst({
      where: { tenantId, name: input.name },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException(`A role named "${input.name}" already exists in this workspace`);
    }
    const role = await this.prisma.role.create({
      data: {
        tenantId,
        name: input.name,
        description: input.description,
        colour: input.colour,
        isSystem: false,
        permissions: {
          create: toPrismaKeys(permissions).map((permissionKey) => ({ permissionKey })),
        },
      },
      ...roleWithGrants,
    });
    await this.audit(tenantId, userId, "role.created", "Role", role.id, {
      name: role.name,
      permissions,
    });
    const { permissions: granted, ...rest } = role;
    return { ...rest, memberCount: 0, permissions: toPermissionKeys(granted) };
  }

  async updateRole(tenantId: string, userId: string, roleId: string, input: UpdateRoleInput) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, tenantId },
      select: { id: true, name: true, isSystem: true },
    });
    if (!role) throw new NotFoundException("Role not found in this workspace");
    if (input.name && input.name !== role.name) {
      const duplicate = await this.prisma.role.findFirst({
        where: { tenantId, name: input.name },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException(
          `A role named "${input.name}" already exists in this workspace`,
        );
      }
    }
    const updated = await this.prisma.role.update({
      where: { id: roleId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.colour !== undefined ? { colour: input.colour } : {}),
      },
      ...roleWithGrants,
    });
    await this.audit(tenantId, userId, "role.updated", "Role", roleId, {
      before: { name: role.name },
      after: { name: updated.name },
    });
    const { _count, permissions, ...rest } = updated;
    return {
      ...rest,
      memberCount: _count.memberships,
      permissions: toPermissionKeys(permissions),
    };
  }

  /**
   * Delete a role. REFUSED while any membership uses it — reassign
   * those members first (the DB also enforces this: Restrict on
   * Membership.roleId). System roles follow the same rule: they can be
   * deleted once unused, but seeding never recreates a deleted one.
   */
  async deleteRole(tenantId: string, userId: string, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, tenantId },
      select: { id: true, name: true, isSystem: true },
    });
    if (!role) throw new NotFoundException("Role not found in this workspace");
    const memberCount = await this.prisma.membership.count({
      where: { tenantId, roleId },
    });
    if (memberCount > 0) {
      throw new ConflictException(
        `Role "${role.name}" is in use by ${memberCount} member(s) — reassign those members first`,
      );
    }
    await this.prisma.role.delete({ where: { id: roleId } });
    await this.audit(tenantId, userId, "role.deleted", "Role", roleId, {
      name: role.name,
      isSystem: role.isSystem,
    });
    return { deleted: roleId };
  }

  /**
   * Replace a role's whole permission set (what the matrix toggles
   * save). Unknown keys are rejected — the catalog is fixed in code.
   * The before/after sets go to the AuditLog.
   */
  async replacePermissions(tenantId: string, userId: string, roleId: string, keys: string[]) {
    const permissions = this.validateKeys(keys);
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, tenantId },
      include: { permissions: { select: { permissionKey: true } } },
    });
    if (!role) throw new NotFoundException("Role not found in this workspace");
    const before = toPermissionKeys(role.permissions);
    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId } }),
      this.prisma.rolePermission.createMany({
        data: toPrismaKeys(permissions).map((permissionKey) => ({
          roleId,
          permissionKey,
        })),
      }),
    ]);
    await this.audit(tenantId, userId, "role.permissions_replaced", "Role", roleId, {
      name: role.name,
      before,
      after: permissions,
    });
    return { id: roleId, name: role.name, permissions };
  }

  /**
   * Assign a role to a member (member invite/edit role dropdown).
   * Both the membership and the role must belong to this tenant.
   * The legacy `MemberRole` enum field is left untouched — `roleId`
   * is what the guard resolves from.
   */
  async assignRole(tenantId: string, userId: string, membershipId: string, roleId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, tenantId },
      include: { roleRef: { select: { id: true, name: true } }, user: { select: { id: true } } },
    });
    if (!membership) {
      throw new NotFoundException("Member not found in this workspace");
    }
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, tenantId },
      select: { id: true, name: true },
    });
    if (!role) throw new NotFoundException("Role not found in this workspace");
    const updated = await this.prisma.membership.update({
      where: { id: membershipId },
      data: { roleId: role.id },
      include: { roleRef: { select: { id: true, name: true } } },
    });
    await this.audit(tenantId, userId, "membership.role_assigned", "Membership", membershipId, {
      before: membership.roleRef
        ? { roleId: membership.roleRef.id, roleName: membership.roleRef.name }
        : { roleId: membership.roleId, roleName: null },
      after: { roleId: role.id, roleName: role.name },
    });
    return updated;
  }

  /** Caller's own effective permission set — backs GET /identity/me. */
  getEffectivePermissions(tenantId: string, userId: string) {
    return loadEffectivePermissions(this.prisma, tenantId, userId);
  }

  private validateKeys(keys: string[]): PermissionKey[] {
    const unknown = keys.filter((k) => !isPermissionKey(k));
    if (unknown.length > 0) {
      throw new BadRequestException(`Unknown permission key(s): ${unknown.join(", ")}`);
    }
    return [...new Set(keys)] as PermissionKey[];
  }

  private audit(
    tenantId: string,
    userId: string,
    action: string,
    entity: string,
    entityId: string,
    metadata: Record<string, unknown>,
  ) {
    return this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action,
        entity,
        entityId,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }
}
