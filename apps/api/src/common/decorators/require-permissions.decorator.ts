import { SetMetadata } from "@nestjs/common";
import type { PermissionKey } from "../../modules/identity/roles/permission-catalog";

export const PERMISSIONS_METADATA_KEY = "agilytics:requirePermissions";
export const ANY_PERMISSION_METADATA_KEY = "agilytics:requireAnyPermission";
export const OWN_OR_ANY_METADATA_KEY = "agilytics:requireOwnOrAny";

/**
 * Require ALL listed permissions. Deny by default: a caller with no
 * membership, no role, or no grant rows for these keys is forbidden.
 * The guard reads the caller's Membership → Role → RolePermission rows
 * for the request tenant — never the client, never a JWT claim the user
 * could self-assert.
 *
 * Usage: `@RequirePermissions("ROLES_MANAGE")` on a handler (or the
 * whole controller). Combine with `JwtAuthGuard` — the JWT guard must
 * run first so `req.user.id` and `req.tenantId` are set.
 */
export const RequirePermissions = (...keys: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_METADATA_KEY, keys);

/**
 * Require AT LEAST ONE of the listed permissions. For reads shared by
 * two jobs, e.g. listing roles for the Roles page (`ROLES_MANAGE`) and
 * for the member invite/edit role dropdown (`MEMBERS_ASSIGN_ROLE`).
 */
export const RequireAnyPermission = (...keys: PermissionKey[]) =>
  SetMetadata(ANY_PERMISSION_METADATA_KEY, keys);

/**
 * Own-vs-any requirement (SYSTEM-DESIGN.md §2.1). The caller passes if
 * they hold `any` (anyone's work), OR they hold `own` AND the resource
 * belongs to them. `owner` extracts the resource owner's user id from
 * the request (route param, query or body) — it must NOT trust a
 * client-supplied owner id for anything but identifying the resource;
 * for DB-backed ownership (e.g. a ticket's assignee) resolve the owner
 * in the service and call `hasOwnOrAny` there instead — see
 * `permissions.guard.ts`.
 */
export interface OwnOrAnyRequirement {
  own: PermissionKey;
  any: PermissionKey;
  /** Owner user id of the resource this request touches, if known from the request. */
  owner: (req: {
    user?: { id?: string };
    params?: Record<string, string>;
    query?: Record<string, string | string[]>;
    body?: Record<string, unknown>;
  }) => string | undefined;
}

export const RequireOwnOrAny = (requirement: OwnOrAnyRequirement) =>
  SetMetadata(OWN_OR_ANY_METADATA_KEY, requirement);
