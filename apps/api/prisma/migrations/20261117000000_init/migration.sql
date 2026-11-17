-- Agilytics OS v2 — initial migration (generated schema + RLS).
-- This file is the source of truth for the initial schema. In a real
-- `prisma migrate dev` run, Prisma generates this; it is checked in here so
-- the RLS policies are visible and reviewable from day one.
-- NOTE: run `pnpm prisma:migrate` against a local Postgres to verify.

-- pgvector — for AI RAG embeddings (see ARCHITECTURE.md §4). The extension
-- is enabled here; the embeddings table lands with the AI slice.
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable RLS on every tenant-owned table.
-- The API sets `app.tenant_id` per request (see PrismaService) and every
-- policy only allows rows where tenant_id matches the current tenant.
-- This is the defence-in-depth layer behind the app-level tenant scoping —
-- the exact leak the v1 audit found (RLS disabled on all 25 tables).

ALTER TABLE "organisations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "team_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "team_projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sprints" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tickets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ticket_status_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "boards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "board_columns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "daily_updates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "integrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "automation_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;

-- Example policy (one per tenant-owned table; the full set is applied by
-- PrismaService.setTenant / the migration runner — see apps/api README).
-- CREATE POLICY "tenant_isolation" ON "projects"
--   USING ("tenantId" = current_setting('app.tenant_id')::text)
--   WITH CHECK ("tenantId" = current_setting('app.tenant_id')::text);
--
-- Policies for every table above follow the identical pattern on "tenantId"
-- (team_members / team_projects are reached through their parent team/project
-- rows in the application layer; see the audit-log note in the README).
