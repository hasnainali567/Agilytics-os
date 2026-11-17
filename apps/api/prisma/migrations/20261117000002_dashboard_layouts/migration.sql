-- Agilytics OS v2 — customisable dashboard + UI (locked decision 20, 2026-11-17).
-- Phase 1, with the Executive Dashboard. Lands BEFORE the first migration
-- is applied to a real database (no production data exists yet).
-- NOTE: run `pnpm prisma:migrate` against a local Postgres to verify.
-- This file is hand-written to match schema.prisma; Prisma would generate
-- the equivalent on `prisma migrate dev`.

-- Dashboard layouts: per user, tenant-scoped, RLS-enabled.
-- layout JSON: { widgets: [{ id, type, x, y, w, h, config }], ui: { density, sidebarCollapsed, navItems } }
CREATE TABLE "dashboard_layouts" (
  "id" "uuid" NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "layout" JSONB NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "template" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dashboard_layouts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dashboard_layouts_userId_tenantId_name_key" ON "dashboard_layouts"("userId", "tenantId", "name");
CREATE INDEX "dashboard_layouts_tenantId_userId_idx" ON "dashboard_layouts"("tenantId", "userId");

ALTER TABLE "dashboard_layouts" ADD CONSTRAINT "dashboard_layouts_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dashboard_layouts" ADD CONSTRAINT "dashboard_layouts_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security: a layout is visible only inside its own tenant.
-- (Matches the RLS pattern in 20261117000000_init / 20261117000001_feature_rework;
-- the API also scopes every query by tenantId, per ARCHITECTURE.md §4.)
ALTER TABLE "dashboard_layouts" ENABLE ROW LEVEL SECURITY;
