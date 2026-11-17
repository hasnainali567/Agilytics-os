-- Agilytics OS v2 — feature-rework migration (FEATURE-EVALUATION.md §8).
-- Approved by Jhon 2026-11-17. Lands BEFORE the first migration is applied
-- to a real database (no production data exists yet), so columns that are
-- NOT NULL in the schema are added here with a backfill/default step first.
-- NOTE: run `pnpm prisma:migrate` against a local Postgres to verify.
-- This file is hand-written to match schema.prisma; Prisma would generate
-- the equivalent on `prisma migrate dev`.

-- New enums
CREATE TYPE "TicketType" AS ENUM ('EPIC', 'STORY', 'TASK', 'BUG');
CREATE TYPE "TicketLinkType" AS ENUM ('BLOCKS', 'BLOCKED_BY', 'RELATES_TO', 'DUPLICATES');
CREATE TYPE "ProjectType" AS ENUM ('SOFTWARE', 'OPS', 'INTERNAL');
CREATE TYPE "NotificationType" AS ENUM ('MENTION', 'ASSIGNMENT', 'BLOCKER', 'AUTOMATION', 'SYSTEM');

-- Projects: key / lead / dates / type
ALTER TABLE "projects" ADD COLUMN "key" TEXT;
ALTER TABLE "projects" ADD COLUMN "leadId" TEXT;
ALTER TABLE "projects" ADD COLUMN "startDate" TIMESTAMP(3);
ALTER TABLE "projects" ADD COLUMN "targetDate" TIMESTAMP(3);
ALTER TABLE "projects" ADD COLUMN "type" "ProjectType" NOT NULL DEFAULT 'SOFTWARE';
-- Backfill: derive a key from the name (first 3 letters, upper-cased) where missing.
UPDATE "projects" SET "key" = UPPER(SUBSTRING("name" FROM 1 FOR 3)) WHERE "key" IS NULL;
ALTER TABLE "projects" ALTER COLUMN "key" SET NOT NULL;
CREATE UNIQUE INDEX "projects_tenantId_key_key" ON "projects"("tenantId", "key");

-- Teams: lead / description / capacity
ALTER TABLE "teams" ADD COLUMN "description" TEXT;
ALTER TABLE "teams" ADD COLUMN "leadId" TEXT;
ALTER TABLE "teams" ADD COLUMN "capacity" INTEGER;

-- Sprints: capacity / retrospective
ALTER TABLE "sprints" ADD COLUMN "capacity" INTEGER;
ALTER TABLE "sprints" ADD COLUMN "retrospective" TEXT;

-- Board columns: optional WIP limit
ALTER TABLE "board_columns" ADD COLUMN "wipLimit" INTEGER;

-- Tickets: key / type / parent / labels / customFields
ALTER TABLE "tickets" ADD COLUMN "key" TEXT;
ALTER TABLE "tickets" ADD COLUMN "type" "TicketType" NOT NULL DEFAULT 'TASK';
ALTER TABLE "tickets" ADD COLUMN "parentId" TEXT;
ALTER TABLE "tickets" ADD COLUMN "labels" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "tickets" ADD COLUMN "customFields" JSONB;
-- Backfill: key from project key + row number per project is done by the
-- application seed/migration job; here we set a placeholder so the column
-- can be made NOT NULL on a fresh database. On a fresh DB there are no rows.
UPDATE "tickets" SET "key" = 'TMP-' || SUBSTRING("id"::text FROM 1 FOR 8) WHERE "key" IS NULL;
ALTER TABLE "tickets" ALTER COLUMN "key" SET NOT NULL;
CREATE UNIQUE INDEX "tickets_projectId_key_key" ON "tickets"("projectId", "key");
CREATE INDEX "tickets_parentId_idx" ON "tickets"("parentId");

-- Comments: edit history (updatedAt)
ALTER TABLE "comments" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Documents: Project Docs, not a wiki — link to ticket / sprint + template
ALTER TABLE "documents" ADD COLUMN "ticketId" TEXT;
ALTER TABLE "documents" ADD COLUMN "sprintId" TEXT;
ALTER TABLE "documents" ADD COLUMN "template" TEXT;

-- New tables
CREATE TABLE "project_guests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_guests_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "project_guests_projectId_userId_key" ON "project_guests"("projectId", "userId");

CREATE TABLE "ticket_watchers" (
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "ticket_watchers_pkey" PRIMARY KEY ("ticketId", "userId")
);

CREATE TABLE "ticket_attachments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "mimeType" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ticket_attachments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ticket_attachments_tenantId_ticketId_idx" ON "ticket_attachments"("tenantId", "ticketId");

CREATE TABLE "ticket_links" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fromTicketId" TEXT NOT NULL,
    "toTicketId" TEXT NOT NULL,
    "type" "TicketLinkType" NOT NULL DEFAULT 'RELATES_TO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ticket_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ticket_links_fromTicketId_toTicketId_type_key" ON "ticket_links"("fromTicketId", "toTicketId", "type");
CREATE INDEX "ticket_links_tenantId_fromTicketId_idx" ON "ticket_links"("tenantId", "fromTicketId");
CREATE INDEX "ticket_links_tenantId_toTicketId_idx" ON "ticket_links"("tenantId", "toTicketId");

CREATE TABLE "time_entries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "minutes" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "time_entries_tenantId_ticketId_idx" ON "time_entries"("tenantId", "ticketId");
CREATE INDEX "time_entries_tenantId_memberId_date_idx" ON "time_entries"("tenantId", "memberId", "date");

CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'SYSTEM',
    "entity" TEXT,
    "entityId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "notifications_tenantId_userId_isRead_idx" ON "notifications"("tenantId", "userId", "isRead");
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- Foreign keys
ALTER TABLE "projects" ADD CONSTRAINT "projects_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "teams" ADD CONSTRAINT "teams_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "sprints"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_guests" ADD CONSTRAINT "project_guests_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_guests" ADD CONSTRAINT "project_guests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket_watchers" ADD CONSTRAINT "ticket_watchers_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket_watchers" ADD CONSTRAINT "ticket_watchers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket_links" ADD CONSTRAINT "ticket_links_fromTicketId_fkey" FOREIGN KEY ("fromTicketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket_links" ADD CONSTRAINT "ticket_links_toTicketId_fkey" FOREIGN KEY ("toTicketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS on the new tenant-owned tables
ALTER TABLE "project_guests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ticket_watchers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ticket_attachments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ticket_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "time_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
-- Policies follow the identical tenantId pattern as the init migration
-- (see apps/api README / PrismaService.setTenant).
