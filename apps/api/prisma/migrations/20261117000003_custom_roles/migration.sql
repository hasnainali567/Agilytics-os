-- Agilytics OS v2 — Custom Roles with Custom Permissions (locked decision 21, 2026-11-17).
-- Phase 1 — roles are needed for the pilot: custom workflows without custom roles is half the story.
-- Lands BEFORE the first migration is applied to a real database (no production data exists yet).
-- NOTE: run `pnpm prisma:migrate` against a local Postgres to verify.
-- This file is hand-written to match schema.prisma; Prisma would generate
-- the equivalent on `prisma migrate dev`.
--
-- Design choices (see SYSTEM-DESIGN.md §2.1):
-- * Permission catalog is the PermissionKey enum (fixed, code-known), NOT a table:
--   every key is referenced by a guard/decorator and by the Roles matrix UI.
-- * Role is tenant-scoped, free-text name, isSystem for the five seeded built-ins.
-- * RolePermission is the join (roleId, permissionKey); revoking = deleting the row.
-- * Membership gains roleId (nullable, Restrict on delete). The legacy MemberRole
--   enum column is KEPT as a fallback during migration: effective permissions
--   resolve from roleId when set, else from the legacy role via the system-role
--   mapping. Backfill (run in the build, after seeding system roles per workspace):
--     UPDATE memberships m SET "roleId" = r.id FROM roles r
--       WHERE r."tenantId" = m."tenantId" AND r.name = m.role::text AND r."isSystem" = true;
--   The legacy enum column is removed in a later migration once every membership
--   has a roleId. Do not add new code that reads it.

-- Permission catalog (fixed list, grouped by area in SYSTEM-DESIGN.md §2.1).
CREATE TYPE "PermissionKey" AS ENUM (
  'WORKSPACE_VIEW_SETTINGS', 'WORKSPACE_EDIT_SETTINGS',
  'MEMBERS_INVITE', 'MEMBERS_REMOVE', 'MEMBERS_ASSIGN_ROLE',
  'ROLES_MANAGE', 'TEAMS_MANAGE', 'BILLING_VIEW', 'BILLING_MANAGE',
  'PROJECTS_CREATE', 'PROJECTS_EDIT', 'PROJECTS_DELETE', 'PROJECTS_VIEW_ALL',
  'BOARDS_CREATE', 'BOARDS_MANAGE_WORKFLOW',
  'TICKETS_CREATE', 'TICKETS_VIEW_ALL', 'TICKETS_EDIT_OWN', 'TICKETS_EDIT_ANY',
  'TICKETS_DELETE', 'TICKETS_ASSIGN', 'TICKETS_MOVE_STATUS', 'TICKETS_COMMENT', 'TICKETS_ATTACH',
  'SPRINTS_CREATE', 'SPRINTS_MANAGE',
  'DAILY_UPDATES_CREATE_OWN', 'DAILY_UPDATES_VIEW_ALL', 'DAILY_UPDATES_EDIT_ANY',
  'DOCS_CREATE', 'DOCS_EDIT_ANY', 'DOCS_DELETE',
  'REPORTING_VIEW', 'REPORTING_VIEW_ALL', 'REPORTING_EXPORT',
  'INTEGRATIONS_CONNECT', 'INTEGRATIONS_DISCONNECT', 'AUTOMATIONS_MANAGE', 'INTEGRATIONS_IMPORT',
  'AI_USE', 'AI_MANAGE_BUDGETS',
  'TIME_VIEW_ALL'
);

-- Roles: one row per workspace role (system-seeded or company-created).
CREATE TABLE "roles" (
  "id" "uuid" NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "colour" TEXT,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "roles_tenantId_name_key" ON "roles"("tenantId", "name");
CREATE INDEX "roles_tenantId_isSystem_idx" ON "roles"("tenantId", "isSystem");

ALTER TABLE "roles" ADD CONSTRAINT "roles_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Role <-> permission grants.
CREATE TABLE "role_permissions" (
  "roleId" "uuid" NOT NULL,
  "permissionKey" "PermissionKey" NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId", "permissionKey")
);

CREATE INDEX "role_permissions_permissionKey_idx" ON "role_permissions"("permissionKey");

ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Memberships gain a role reference. Restrict: a role in use cannot be deleted.
ALTER TABLE "memberships" ADD COLUMN "roleId" "uuid";
CREATE INDEX "memberships_tenantId_roleId_idx" ON "memberships"("tenantId", "roleId");

ALTER TABLE "memberships" ADD CONSTRAINT "memberships_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row-level security: roles and their grants are visible only inside their own tenant.
-- (Matches the RLS pattern in the earlier migrations; the API also scopes every
-- query by tenantId, per ARCHITECTURE.md §4.)
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;
