// Must be first: ts-node does not load .env on its own, so without this
// process.env.DATABASE_URL is undefined and PrismaPg defaults to
// localhost:5432 -> ECONNREFUSED, no matter what is in apps/api/.env.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type PermissionKey as PrismaPermissionKey } from "@prisma/client";
import {
  SYSTEM_ROLE_DEFAULTS,
  SYSTEM_ROLE_NAMES,
  type SystemRoleName,
} from "../src/modules/identity/roles/permission-catalog";

// Prisma 7 requires a driver adapter. Seed connects through the Neon
// pooler URL (DATABASE_URL); run with `prisma db seed` after migrate.
//
// ---------------------------------------------------------------------------
// DEMO DATASET — IDEMPOTENT. Every row is upserted on a unique key (or a
// fixed id where the table has no natural unique key), so re-running the
// seed never duplicates or crashes. It DOES update titles, statuses,
// assignees and estimates on re-run, so a re-seed refreshes the demo data.
//
// TEST USERS (all in tenant "demo-tenant", no passwords — dev-login only):
// | email                     | role           | userId         |
// |---------------------------|----------------|----------------|
// | platform@agilytics.local  | PLATFORM_ADMIN | platform-admin |
// | owner@agilytics.local     | OWNER          | owner-user     |
// | admin@agilytics.local     | ADMIN          | admin-user     |
// | lead@agilytics.local      | LEAD           | lead-user      |
// | demo@agilytics.local      | MEMBER         | demo-user      |
// | viewer@agilytics.local    | VIEWER         | viewer-user    |
//
// PLATFORM ADMIN NOTE: there is NO database mechanism for platform roles.
// PlatformAdminGuard requires req.platformRole === "PLATFORM_ADMIN". In
// production that comes from the Cognito JWT strategy
// (custom:platform_role claim). In DEV, POST /auth/dev-login signs a
// platformRole claim for userId "platform-admin" only, and the dev
// JwtAuthGuard copies it onto req.platformRole — so the platform-admin
// test user CAN reach /admin in dev. The seed also gives the user an
// OWNER membership in demo-tenant so the account can use the workspace.
// See workspace/goals/agilytics-v2-ai-powered-team-operating-system/files/TEST-USERS.md.
//
// LOG IN: open the web app's /login page, pick one of the six users below
// (or type their email) and sign in — no password. The page calls the
// DEV-ONLY POST /auth/dev-login with { userId, tenantId: "demo-tenant" }
// and stores the 1h JWT in localStorage. (If the login page is ever
// removed, the same call works from curl — see TEST-USERS.md.)
// ---------------------------------------------------------------------------

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const TENANT_ID = "demo-tenant";

type TestUser = {
  id: string;
  email: string;
  name: string;
  /** Legacy MemberRole enum value stored on the membership. */
  legacyRole: "OWNER" | "ADMIN" | "LEAD" | "MEMBER" | "VIEWER";
  /** Matching seeded system Role name (null for the platform admin). */
  systemRole: SystemRoleName | null;
};

const TEST_USERS: TestUser[] = [
  {
    id: "platform-admin",
    email: "platform@agilytics.local",
    name: "Platform Admin",
    legacyRole: "OWNER",
    systemRole: null, // No workspace role carries platform rights (see header).
  },
  { id: "owner-user", email: "owner@agilytics.local", name: "Olivia Owner", legacyRole: "OWNER", systemRole: "OWNER" },
  { id: "admin-user", email: "admin@agilytics.local", name: "Adam Admin", legacyRole: "ADMIN", systemRole: "ADMIN" },
  { id: "lead-user", email: "lead@agilytics.local", name: "Lena Lead", legacyRole: "LEAD", systemRole: "LEAD" },
  { id: "demo-user", email: "demo@agilytics.local", name: "Demo User", legacyRole: "MEMBER", systemRole: "MEMBER" },
  { id: "viewer-user", email: "viewer@agilytics.local", name: "Victor Viewer", legacyRole: "VIEWER", systemRole: "VIEWER" },
];

const COLUMNS = [
  { name: "Backlog", order: 0, colour: "#64748B", category: "TODO" as const },
  { name: "To Do", order: 1, colour: "#3B82F6", category: "TODO" as const },
  { name: "In Progress", order: 2, colour: "#F59E0B", category: "IN_PROGRESS" as const },
  { name: "Review", order: 3, colour: "#8B5CF6", category: "IN_PROGRESS" as const },
  { name: "Done", order: 4, colour: "#22C55E", category: "DONE" as const },
];

type TicketSeed = {
  key: string;
  title: string;
  type: "EPIC" | "STORY" | "TASK" | "BUG";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  estimate: number;
  /** Column name on the project's default board. */
  status: string;
  /** Which sprint the ticket belongs to; null = backlog (no sprint). */
  sprint: "active" | "completed" | null;
  assigneeId: string;
  dueDate: string;
};

type ProjectSeed = {
  key: string;
  name: string;
  description: string;
  leadId: string;
  targetDate: string;
  tickets: TicketSeed[];
};

const PROJECTS: ProjectSeed[] = [
  {
    key: "WEB",
    name: "Website Redesign",
    description: "New marketing site and dashboard shell on the Agibankz design.",
    leadId: "lead-user",
    targetDate: "2026-12-18",
    tickets: [
      { key: "WEB-1", title: "Build the Home dashboard", type: "TASK", priority: "HIGH", estimate: 5, status: "In Progress", sprint: "active", assigneeId: "demo-user", dueDate: "2026-11-21" },
      { key: "WEB-2", title: "Redesign the marketing landing page", type: "STORY", priority: "HIGH", estimate: 8, status: "Review", sprint: "active", assigneeId: "lead-user", dueDate: "2026-11-24" },
      { key: "WEB-3", title: "Migrate the design system to Agibankz tokens", type: "TASK", priority: "MEDIUM", estimate: 5, status: "In Progress", sprint: "active", assigneeId: "admin-user", dueDate: "2026-11-26" },
      { key: "WEB-4", title: "Add dark-mode toggle to the sidebar", type: "TASK", priority: "LOW", estimate: 3, status: "To Do", sprint: "active", assigneeId: "demo-user", dueDate: "2026-11-28" },
      { key: "WEB-5", title: "Fix dashboard widgets overflowing on small screens", type: "BUG", priority: "URGENT", estimate: 3, status: "In Progress", sprint: "active", assigneeId: "lead-user", dueDate: "2026-11-20" },
      { key: "WEB-6", title: "Set up Vercel preview deployments for every PR", type: "TASK", priority: "MEDIUM", estimate: 3, status: "Done", sprint: "completed", assigneeId: "admin-user", dueDate: "2026-11-13" },
      { key: "WEB-7", title: "Audit homepage accessibility (WCAG AA)", type: "TASK", priority: "MEDIUM", estimate: 5, status: "Done", sprint: "completed", assigneeId: "demo-user", dueDate: "2026-11-12" },
      { key: "WEB-8", title: "New pricing page for PKR tiers", type: "STORY", priority: "HIGH", estimate: 8, status: "To Do", sprint: "active", assigneeId: "owner-user", dueDate: "2026-12-02" },
      { key: "WEB-9", title: "Blog: how Saylani bootcamps run on Agilytics", type: "TASK", priority: "LOW", estimate: 2, status: "Backlog", sprint: null, assigneeId: "owner-user", dueDate: "2026-12-05" },
      { key: "WEB-10", title: "Epic: Public website launch", type: "EPIC", priority: "HIGH", estimate: 13, status: "Backlog", sprint: null, assigneeId: "lead-user", dueDate: "2026-12-12" },
    ],
  },
  {
    key: "MOB",
    name: "Mobile App",
    description: "Agilytics on the go: Today feed, boards and approvals from a phone.",
    leadId: "admin-user",
    targetDate: "2026-12-22",
    tickets: [
      { key: "MOB-1", title: "Design the mobile Today feed", type: "STORY", priority: "HIGH", estimate: 8, status: "In Progress", sprint: "active", assigneeId: "lead-user", dueDate: "2026-11-25" },
      { key: "MOB-2", title: "Push notifications for ticket mentions", type: "TASK", priority: "MEDIUM", estimate: 5, status: "To Do", sprint: "active", assigneeId: "admin-user", dueDate: "2026-11-27" },
      { key: "MOB-3", title: "Offline caching for the ticket board", type: "TASK", priority: "HIGH", estimate: 8, status: "In Progress", sprint: "active", assigneeId: "demo-user", dueDate: "2026-11-28" },
      { key: "MOB-4", title: "Fix crash on login when the token expires", type: "BUG", priority: "URGENT", estimate: 3, status: "Review", sprint: "active", assigneeId: "demo-user", dueDate: "2026-11-20" },
      { key: "MOB-5", title: "Add biometric unlock", type: "TASK", priority: "MEDIUM", estimate: 5, status: "Backlog", sprint: null, assigneeId: "admin-user", dueDate: "2026-12-08" },
      { key: "MOB-6", title: "Onboarding walkthrough for new members", type: "STORY", priority: "MEDIUM", estimate: 5, status: "Done", sprint: "completed", assigneeId: "lead-user", dueDate: "2026-11-13" },
      { key: "MOB-7", title: "App icon and splash screen refresh", type: "TASK", priority: "LOW", estimate: 2, status: "Done", sprint: "completed", assigneeId: "demo-user", dueDate: "2026-11-11" },
      { key: "MOB-8", title: "Epic: Mobile app v1 launch", type: "EPIC", priority: "HIGH", estimate: 13, status: "Backlog", sprint: null, assigneeId: "owner-user", dueDate: "2026-12-19" },
      { key: "MOB-9", title: "Deep links for ticket URLs", type: "TASK", priority: "LOW", estimate: 3, status: "To Do", sprint: "active", assigneeId: "lead-user", dueDate: "2026-12-01" },
      { key: "MOB-10", title: "Reduce app bundle size below 25 MB", type: "TASK", priority: "MEDIUM", estimate: 5, status: "To Do", sprint: "active", assigneeId: "admin-user", dueDate: "2026-12-03" },
    ],
  },
  {
    key: "API",
    name: "Platform API",
    description: "Public API, webhooks and the integration backbone for Slack and GitHub.",
    leadId: "owner-user",
    targetDate: "2026-12-15",
    tickets: [
      { key: "API-1", title: "Rate limiting and WAF rules for public endpoints", type: "TASK", priority: "HIGH", estimate: 5, status: "In Progress", sprint: "active", assigneeId: "admin-user", dueDate: "2026-11-24" },
      { key: "API-2", title: "Webhook delivery with retries", type: "STORY", priority: "HIGH", estimate: 8, status: "Review", sprint: "active", assigneeId: "owner-user", dueDate: "2026-11-26" },
      { key: "API-3", title: "Add cursor pagination to the ticket list", type: "TASK", priority: "MEDIUM", estimate: 3, status: "Done", sprint: "completed", assigneeId: "demo-user", dueDate: "2026-11-12" },
      { key: "API-4", title: "Public REST API for integrations (Slack / GitHub)", type: "STORY", priority: "HIGH", estimate: 13, status: "In Progress", sprint: "active", assigneeId: "lead-user", dueDate: "2026-11-28" },
      { key: "API-5", title: "Rotate KMS keys for integration tokens", type: "TASK", priority: "URGENT", estimate: 3, status: "To Do", sprint: "active", assigneeId: "admin-user", dueDate: "2026-11-21" },
      { key: "API-6", title: "Fix N+1 query on dashboard stats", type: "BUG", priority: "HIGH", estimate: 3, status: "Done", sprint: "completed", assigneeId: "demo-user", dueDate: "2026-11-13" },
      { key: "API-7", title: "Audit log export to CSV", type: "TASK", priority: "MEDIUM", estimate: 5, status: "To Do", sprint: "active", assigneeId: "owner-user", dueDate: "2026-12-01" },
      { key: "API-8", title: "Epic: API v2 with versioned routes", type: "EPIC", priority: "HIGH", estimate: 13, status: "Backlog", sprint: null, assigneeId: "lead-user", dueDate: "2026-12-14" },
      { key: "API-9", title: "Health-check endpoint for the uptime monitor", type: "TASK", priority: "LOW", estimate: 2, status: "Done", sprint: "completed", assigneeId: "admin-user", dueDate: "2026-11-10" },
      { key: "API-10", title: "Document the auth flow (Cognito + dev-login)", type: "TASK", priority: "LOW", estimate: 3, status: "Backlog", sprint: null, assigneeId: "demo-user", dueDate: "2026-12-04" },
    ],
  },
];

/**
 * Daily updates for the last ~5 days (2026-11-15..19). One row per
 * member/ticket/day — upserted on [ticketId, memberId, date].
 * Two carry real blockers (WEB-5, MOB-3) so the Today feed / blocker
 * lists have something to show.
 */
type DailyUpdateSeed = {
  ticketKey: string;
  memberId: string;
  date: string;
  doneToday: string;
  next: string;
  blockers: string | null;
  hasBlocker: boolean;
  progressPercent: number;
  health: "ON_TRACK" | "AT_RISK" | "BLOCKED";
  timeSpentMin: number;
};

const DAILY_UPDATES: DailyUpdateSeed[] = [
  { ticketKey: "WEB-1", memberId: "demo-user", date: "2026-11-17", doneToday: "Finished the dashboard widget grid and stat cards.", next: "Wire the widgets to the reporting API.", blockers: null, hasBlocker: false, progressPercent: 60, health: "ON_TRACK", timeSpentMin: 240 },
  { ticketKey: "WEB-1", memberId: "demo-user", date: "2026-11-18", doneToday: "Wired KPI and velocity widgets to live data.", next: "Polish empty states and loading skeletons.", blockers: null, hasBlocker: false, progressPercent: 75, health: "ON_TRACK", timeSpentMin: 300 },
  { ticketKey: "WEB-1", memberId: "demo-user", date: "2026-11-19", doneToday: "Added loading skeletons; dashboard renders end to end.", next: "Hand over to Lena for a design review.", blockers: null, hasBlocker: false, progressPercent: 80, health: "ON_TRACK", timeSpentMin: 180 },
  { ticketKey: "WEB-5", memberId: "lead-user", date: "2026-11-19", doneToday: "Reproduced the overflow on a 360px viewport, not on desktop.", next: "Fix the widget grid min-width once QA shares device logs.", blockers: "Overflow only reproduces on a physical device — waiting on device logs from QA.", hasBlocker: true, progressPercent: 40, health: "BLOCKED", timeSpentMin: 120 },
  { ticketKey: "WEB-3", memberId: "admin-user", date: "2026-11-18", doneToday: "Mapped the old palette to Agibankz tokens in the theme file.", next: "Swap the remaining hardcoded colours in the sidebar.", blockers: null, hasBlocker: false, progressPercent: 45, health: "ON_TRACK", timeSpentMin: 200 },
  { ticketKey: "MOB-1", memberId: "lead-user", date: "2026-11-18", doneToday: "Sketched the Today feed cards and blocker section.", next: "Build the feed list with pull-to-refresh.", blockers: null, hasBlocker: false, progressPercent: 55, health: "ON_TRACK", timeSpentMin: 240 },
  { ticketKey: "MOB-1", memberId: "lead-user", date: "2026-11-19", doneToday: "Built the feed list; blockers show at the top.", next: "Add the stale-ticket badge.", blockers: null, hasBlocker: false, progressPercent: 65, health: "ON_TRACK", timeSpentMin: 200 },
  { ticketKey: "MOB-3", memberId: "demo-user", date: "2026-11-19", doneToday: "Designed the offline cache shape; no code yet.", next: "Start the sync queue once API-4 lands the auth scope.", blockers: "Blocked on API-4 — the public API auth scope is not ready yet.", hasBlocker: true, progressPercent: 30, health: "BLOCKED", timeSpentMin: 90 },
  { ticketKey: "API-1", memberId: "admin-user", date: "2026-11-17", doneToday: "Drafted rate-limit tiers per plan.", next: "Implement the limiter middleware.", blockers: null, hasBlocker: false, progressPercent: 40, health: "ON_TRACK", timeSpentMin: 180 },
  { ticketKey: "API-1", memberId: "admin-user", date: "2026-11-18", doneToday: "Limiter middleware in place on the ticket routes.", next: "Add WAF rules for the public endpoints.", blockers: null, hasBlocker: false, progressPercent: 60, health: "ON_TRACK", timeSpentMin: 240 },
  { ticketKey: "API-1", memberId: "admin-user", date: "2026-11-19", doneToday: "WAF rules drafted; one rule still flags legit traffic.", next: "Tune the rule and re-test with the load script.", blockers: null, hasBlocker: false, progressPercent: 70, health: "AT_RISK", timeSpentMin: 210 },
  { ticketKey: "API-2", memberId: "owner-user", date: "2026-11-19", doneToday: "Designed the retry schedule (exponential backoff, 5 attempts).", next: "Implement the delivery worker.", blockers: null, hasBlocker: false, progressPercent: 50, health: "ON_TRACK", timeSpentMin: 150 },
];

const TIME_ENTRIES = [
  { id: "time-1", ticketKey: "WEB-1", memberId: "demo-user", date: "2026-11-18", minutes: 300, note: "Wiring widgets to the reporting API." },
  { id: "time-2", ticketKey: "WEB-1", memberId: "demo-user", date: "2026-11-19", minutes: 180, note: "Loading skeletons and empty states." },
  { id: "time-3", ticketKey: "MOB-1", memberId: "lead-user", date: "2026-11-19", minutes: 200, note: "Today feed list with pull-to-refresh." },
  { id: "time-4", ticketKey: "API-1", memberId: "admin-user", date: "2026-11-19", minutes: 210, note: "WAF rule tuning and load testing." },
  { id: "time-5", ticketKey: "WEB-5", memberId: "lead-user", date: "2026-11-19", minutes: 120, note: "Reproducing the small-screen overflow." },
  { id: "time-6", ticketKey: "API-2", memberId: "owner-user", date: "2026-11-19", minutes: 150, note: "Webhook retry schedule design." },
];

const NOTIFICATIONS = [
  { id: "notif-1", userId: "demo-user", type: "ASSIGNMENT" as const, entity: "Ticket", entityId: "WEB-5", title: "You were assigned WEB-5", body: "Lena assigned you 'Fix dashboard widgets overflowing on small screens'.", isRead: false },
  { id: "notif-2", userId: "lead-user", type: "BLOCKER" as const, entity: "Ticket", entityId: "MOB-3", title: "MOB-3 is blocked", body: "Offline caching is blocked by API-4 — the public API auth scope is not ready.", isRead: false },
  { id: "notif-3", userId: "admin-user", type: "MENTION" as const, entity: "Ticket", entityId: "API-2", title: "Olivia mentioned you in API-2", body: "@admin-user can you review the retry schedule before the worker lands?", isRead: false },
  { id: "notif-4", userId: "demo-user", type: "SYSTEM" as const, entity: "Sprint", entityId: "sprint-web-2", title: "Sprint 2 started", body: "Website Redesign — Sprint 2 runs 17–28 Nov 2026.", isRead: true },
  { id: "notif-5", userId: "owner-user", type: "ASSIGNMENT" as const, entity: "Ticket", entityId: "API-2", title: "You were assigned API-2", body: "You are now the assignee for 'Webhook delivery with retries'.", isRead: true },
  { id: "notif-6", userId: "lead-user", type: "AUTOMATION" as const, entity: "Ticket", entityId: null, title: "Daily reminder: 2 tickets look stale", body: "WEB-9 and API-10 have had no update in 5 days.", isRead: false },
];

/** Ticket dependency links (BLOCKED_BY = fromTicket is blocked by toTicket). */
const TICKET_LINKS = [
  { fromKey: "MOB-3", toKey: "API-4", type: "BLOCKED_BY" as const },
  { fromKey: "WEB-2", toKey: "WEB-1", type: "BLOCKED_BY" as const },
];

// Demo automation rules (Phase 2, worker-b) — idempotent upserts on
// fixed ids, like NOTIFICATIONS above. Safe: slack.post is a graceful
// no-op until SLACK_BOT_TOKEN is set; notification.create only writes
// an inbox row for the assignee. No webhook rule is seeded (no URL to
// call in demo). All 6 test users are untouched.
const AUTOMATION_RULES = [
  {
    id: "seed-rule-done-slack",
    name: "Announce done tickets in Slack",
    trigger: "ticket.done",
    action: "slack.post",
    config: { channel: "#agilytics", template: "Done — {ticket.key}: {ticket.title}" },
  },
  {
    id: "seed-rule-overdue-notify",
    name: "Nudge assignee on stale tickets",
    trigger: "ticket.overdue",
    action: "notification.create",
    config: { message: "{ticket.key}: {ticket.title} — no daily update in 3 days. Please post an update." },
  },
  {
    id: "seed-rule-created-notify",
    name: "Notify assignee on new tickets",
    trigger: "ticket.created",
    action: "notification.create",
    config: { message: "New ticket assigned to you — {ticket.key}: {ticket.title}" },
  },
];

async function main() {
  // Fixed id "demo-tenant": the web app's dev-login (apps/web/src/lib/authFetch.ts)
  // logs in as tenant demo-tenant, so the seeded org must have that id or
  // the dashboard queries a tenant with no data.
  const org = await prisma.organisation.upsert({
    where: { slug: "demo" },
    update: {},
    create: { id: TENANT_ID, name: "Demo Organisation", slug: "demo" },
  });

  // System roles — same logic as seedSystemRoles() in
  // apps/api/src/modules/identity/roles/roles.service.ts, inlined here
  // because that helper takes a PrismaService (NestJS) and the seed only
  // has a PrismaClient. An existing system role (and its grants) is left
  // completely untouched, so re-running never wipes an admin's edits.
  const systemRoleIds = new Map<SystemRoleName, string>();
  for (const name of SYSTEM_ROLE_NAMES) {
    const existing = await prisma.role.findFirst({
      where: { tenantId: org.id, name, isSystem: true },
      select: { id: true },
    });
    if (existing) {
      systemRoleIds.set(name, existing.id);
      continue;
    }
    const role = await prisma.role.create({
      data: {
        tenantId: org.id,
        name,
        description: "System role — seeded defaults, editable by the workspace admin.",
        isSystem: true,
        permissions: {
          // Same cast as toPrismaKeys() in roles.service.ts: the catalog
          // stores keys as plain string literals, Prisma wants its enum.
          create: SYSTEM_ROLE_DEFAULTS[name].map((permissionKey) => ({
            permissionKey: permissionKey as PrismaPermissionKey,
          })),
        },
      },
    });
    systemRoleIds.set(name, role.id);
  }

  // Test users + memberships. The membership upsert also repairs the old
  // seed's demo-user row (it was OWNER with no roleId) into MEMBER.
  for (const u of TEST_USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name },
      create: { id: u.id, email: u.email, name: u.name },
    });
    const roleId = u.systemRole ? systemRoleIds.get(u.systemRole) : systemRoleIds.get("OWNER");
    await prisma.membership.upsert({
      where: { tenantId_userId: { tenantId: org.id, userId: user.id } },
      update: { role: u.legacyRole, roleId },
      create: { tenantId: org.id, userId: user.id, role: u.legacyRole, roleId },
    });
  }

  // Demo billing + invite (2026-11-19): demo-tenant runs on STARTER
  // with a 14-day trial — but only if it is still FREE, so a re-seed
  // never extends the trial. Plus one pending demo invite so the
  // accept flow can be tried without inviting a real address. The
  // invite is re-issued (PENDING, fresh 7-day expiry) on every
  // re-seed, so accepting it in dev never permanently consumes it.
  // Its token is a fixed demo value — accept it with
  // POST /members/invites/0123456789abcdef…/accept as any test user.
  const demoOrg = await prisma.organisation.findUnique({
    where: { id: org.id },
    select: { plan: true },
  });
  if (demoOrg?.plan === "FREE") {
    const now = new Date();
    await prisma.organisation.update({
      where: { id: org.id },
      data: {
        plan: "STARTER",
        planStartedAt: now,
        trialEndsAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      },
    });
  }
  const memberRoleId = systemRoleIds.get("MEMBER");
  if (memberRoleId) {
    await prisma.invite.upsert({
      where: { id: "seed-invite-1" },
      update: {
        status: "PENDING",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      create: {
        id: "seed-invite-1",
        tenantId: org.id,
        email: "newteammate@agilytics.local",
        roleId: memberRoleId,
        invitedById: "owner-user",
        token: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  }

  // Projects, sprints, boards, columns, tickets.
  const ticketIds = new Map<string, string>();
  for (const p of PROJECTS) {
    const project = await prisma.project.upsert({
      where: { tenantId_key: { tenantId: org.id, key: p.key } },
      update: { name: p.name, description: p.description, leadId: p.leadId, targetDate: new Date(p.targetDate) },
      create: {
        tenantId: org.id,
        key: p.key,
        name: p.name,
        description: p.description,
        leadId: p.leadId,
        startDate: new Date("2026-11-03"),
        targetDate: new Date(p.targetDate),
      },
    });

    const sprints = {
      completed: await prisma.sprint.upsert({
        where: { id: `sprint-${p.key.toLowerCase()}-1` },
        update: { name: "Sprint 1", goal: "Foundations and setup.", startDate: new Date("2026-11-03"), endDate: new Date("2026-11-14"), status: "COMPLETED", capacity: 30 },
        create: {
          id: `sprint-${p.key.toLowerCase()}-1`,
          tenantId: org.id,
          projectId: project.id,
          name: "Sprint 1",
          goal: "Foundations and setup.",
          startDate: new Date("2026-11-03"),
          endDate: new Date("2026-11-14"),
          status: "COMPLETED",
          capacity: 30,
        },
      }),
      active: await prisma.sprint.upsert({
        where: { id: `sprint-${p.key.toLowerCase()}-2` },
        update: { name: "Sprint 2", goal: "Ship the next usable slice.", startDate: new Date("2026-11-17"), endDate: new Date("2026-11-28"), status: "ACTIVE", capacity: 34 },
        create: {
          id: `sprint-${p.key.toLowerCase()}-2`,
          tenantId: org.id,
          projectId: project.id,
          name: "Sprint 2",
          goal: "Ship the next usable slice.",
          startDate: new Date("2026-11-17"),
          endDate: new Date("2026-11-28"),
          status: "ACTIVE",
          capacity: 34,
        },
      }),
    };

    const board = await prisma.board.upsert({
      where: { id: `board-${p.key.toLowerCase()}` },
      update: { name: "Main board", isDefault: true },
      create: { id: `board-${p.key.toLowerCase()}`, tenantId: org.id, projectId: project.id, name: "Main board", isDefault: true },
    });
    const columnIds = new Map<string, string>();
    for (const c of COLUMNS) {
      const col = await prisma.boardColumn.upsert({
        where: { id: `col-${p.key.toLowerCase()}-${c.name.toLowerCase().replace(/ /g, "-")}` },
        update: { name: c.name, order: c.order, colour: c.colour, category: c.category },
        create: {
          id: `col-${p.key.toLowerCase()}-${c.name.toLowerCase().replace(/ /g, "-")}`,
          tenantId: org.id,
          boardId: board.id,
          name: c.name,
          order: c.order,
          colour: c.colour,
          category: c.category,
        },
      });
      columnIds.set(c.name, col.id);
    }

    for (const t of p.tickets) {
      const ticket = await prisma.ticket.upsert({
        where: { projectId_key: { projectId: project.id, key: t.key } },
        update: {
          title: t.title,
          type: t.type,
          priority: t.priority,
          estimate: t.estimate,
          statusId: columnIds.get(t.status),
          sprintId: t.sprint ? sprints[t.sprint].id : null,
          boardId: board.id,
          assigneeId: t.assigneeId,
          dueDate: new Date(t.dueDate),
        },
        create: {
          tenantId: org.id,
          projectId: project.id,
          sprintId: t.sprint ? sprints[t.sprint].id : null,
          boardId: board.id,
          statusId: columnIds.get(t.status),
          key: t.key,
          type: t.type,
          title: t.title,
          priority: t.priority,
          estimate: t.estimate,
          assigneeId: t.assigneeId,
          dueDate: new Date(t.dueDate),
        },
      });
      ticketIds.set(t.key, ticket.id);
    }
  }

  // Ticket dependency links.
  for (const l of TICKET_LINKS) {
    const fromId = ticketIds.get(l.fromKey);
    const toId = ticketIds.get(l.toKey);
    if (!fromId || !toId) continue;
    await prisma.ticketLink.upsert({
      where: { fromTicketId_toTicketId_type: { fromTicketId: fromId, toTicketId: toId, type: l.type } },
      update: {},
      create: { tenantId: org.id, fromTicketId: fromId, toTicketId: toId, type: l.type },
    });
  }

  // Daily updates (last ~5 days), time entries, notifications.
  for (const u of DAILY_UPDATES) {
    const ticketId = ticketIds.get(u.ticketKey);
    if (!ticketId) continue;
    await prisma.dailyUpdate.upsert({
      where: { ticketId_memberId_date: { ticketId, memberId: u.memberId, date: new Date(u.date) } },
      update: {
        doneToday: u.doneToday,
        next: u.next,
        blockers: u.blockers,
        hasBlocker: u.hasBlocker,
        progressPercent: u.progressPercent,
        health: u.health,
        timeSpentMin: u.timeSpentMin,
      },
      create: {
        tenantId: org.id,
        ticketId,
        memberId: u.memberId,
        date: new Date(u.date),
        doneToday: u.doneToday,
        next: u.next,
        blockers: u.blockers,
        hasBlocker: u.hasBlocker,
        progressPercent: u.progressPercent,
        health: u.health,
        timeSpentMin: u.timeSpentMin,
      },
    });
  }
  for (const e of TIME_ENTRIES) {
    const ticketId = ticketIds.get(e.ticketKey);
    if (!ticketId) continue;
    await prisma.timeEntry.upsert({
      where: { id: e.id },
      update: { ticketId, memberId: e.memberId, date: new Date(e.date), minutes: e.minutes, note: e.note },
      create: { id: e.id, tenantId: org.id, ticketId, memberId: e.memberId, date: new Date(e.date), minutes: e.minutes, note: e.note },
    });
  }
  for (const n of NOTIFICATIONS) {
    await prisma.notification.upsert({
      where: { id: n.id },
      update: { userId: n.userId, type: n.type, entity: n.entity, entityId: n.entityId, title: n.title, body: n.body, isRead: n.isRead },
      create: { id: n.id, tenantId: org.id, userId: n.userId, type: n.type, entity: n.entity, entityId: n.entityId, title: n.title, body: n.body, isRead: n.isRead },
    });
  }

  // Demo automation rules (Phase 2) — see AUTOMATION_RULES above.
  for (const r of AUTOMATION_RULES) {
    await prisma.automationRule.upsert({
      where: { id: r.id },
      update: { name: r.name, trigger: r.trigger, action: r.action, config: r.config },
      create: { id: r.id, tenantId: org.id, name: r.name, trigger: r.trigger, action: r.action, config: r.config },
    });
  }

  console.log(
    `Seeded org ${org.id}: ${TEST_USERS.length} users, ${PROJECTS.length} projects, ` +
      `${PROJECTS.reduce((n, p) => n + p.tickets.length, 0)} tickets, ` +
      `${DAILY_UPDATES.length} daily updates, ${TIME_ENTRIES.length} time entries, ` +
      `${NOTIFICATIONS.length} notifications, plan STARTER (trial), 1 demo invite.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
