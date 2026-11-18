/**
 * Permission catalog + system-role defaults (locked decision 21,
 * 2026-11-17; see SYSTEM-DESIGN.md §2.1).
 *
 * The catalog is a FIXED list of 42 keys grouped by area. It is defined
 * here as plain string literals — deliberately NOT imported from
 * `@prisma/client`: the generated client may not exist yet in a fresh
 * checkout (`prisma generate` runs later), and the enum values are just
 * strings at runtime. The literals must match the `PermissionKey` enum
 * in `apps/api/prisma/schema.prisma` exactly (SCREAMING_SNAKE_CASE).
 * Adding a permission is a code change: new enum value + migration +
 * a guard use + a matrix row here.
 *
 * `PermissionKey` below is the app-level string-union type. At Prisma
 * call sites it is cast to the Prisma enum type (`import type` only —
 * erased at runtime, so it never depends on the generated client).
 */

export const PERMISSION_AREAS = [
  "workspace",
  "projects",
  "boards",
  "tickets",
  "sprints",
  "daily_updates",
  "docs",
  "reporting",
  "integrations",
  "ai",
  "time",
] as const;

export type PermissionArea = (typeof PERMISSION_AREAS)[number];

export interface PermissionDefinition {
  /** Prisma `PermissionKey` enum value, e.g. `TICKETS_EDIT_OWN`. */
  key: string;
  /** Dot-notation label from SYSTEM-DESIGN.md §2.1, e.g. `tickets.edit_own`. */
  label: string;
  area: PermissionArea;
  /** One-line plain-language description for the Roles matrix UI. */
  description: string;
}

const def = (
  key: string,
  label: string,
  area: PermissionArea,
  description: string,
): PermissionDefinition => ({ key, label, area, description });

export const PERMISSION_CATALOG: PermissionDefinition[] = [
  // Workspace, members, roles, teams
  def("WORKSPACE_VIEW_SETTINGS", "workspace.view_settings", "workspace", "View workspace settings"),
  def(
    "WORKSPACE_EDIT_SETTINGS",
    "workspace.edit_settings",
    "workspace",
    "Change workspace settings",
  ),
  def("MEMBERS_INVITE", "members.invite", "workspace", "Invite members to the workspace"),
  def("MEMBERS_REMOVE", "members.remove", "workspace", "Remove members from the workspace"),
  def("MEMBERS_ASSIGN_ROLE", "members.assign_role", "workspace", "Change a member's role"),
  def(
    "ROLES_MANAGE",
    "roles.manage",
    "workspace",
    "Create, edit and delete roles and their permissions",
  ),
  def("TEAMS_MANAGE", "teams.manage", "workspace", "Create and manage teams"),
  def("BILLING_VIEW", "billing.view", "workspace", "View billing and plan details"),
  def("BILLING_MANAGE", "billing.manage", "workspace", "Change plan, payment method and billing"),
  // Projects
  def("PROJECTS_CREATE", "projects.create", "projects", "Create projects"),
  def("PROJECTS_EDIT", "projects.edit", "projects", "Edit any project"),
  def("PROJECTS_DELETE", "projects.delete", "projects", "Delete projects"),
  def("PROJECTS_VIEW_ALL", "projects.view_all", "projects", "See all projects in the workspace"),
  // Boards / custom workflows
  def("BOARDS_CREATE", "boards.create", "boards", "Create boards"),
  def(
    "BOARDS_MANAGE_WORKFLOW",
    "boards.manage_workflow",
    "boards",
    "Rename, reorder, add or remove workflow statuses",
  ),
  // Tickets
  def("TICKETS_CREATE", "tickets.create", "tickets", "Create tickets"),
  def("TICKETS_VIEW_ALL", "tickets.view_all", "tickets", "See everyone's tickets"),
  def(
    "TICKETS_EDIT_OWN",
    "tickets.edit_own",
    "tickets",
    "Edit tickets assigned to you or authored by you",
  ),
  def("TICKETS_EDIT_ANY", "tickets.edit_any", "tickets", "Edit anyone's tickets"),
  def("TICKETS_DELETE", "tickets.delete", "tickets", "Delete tickets"),
  def("TICKETS_ASSIGN", "tickets.assign", "tickets", "Assign tickets to members"),
  def(
    "TICKETS_MOVE_STATUS",
    "tickets.move_status",
    "tickets",
    "Move tickets between workflow statuses",
  ),
  def("TICKETS_COMMENT", "tickets.comment", "tickets", "Comment on tickets"),
  def("TICKETS_ATTACH", "tickets.attach", "tickets", "Attach files to tickets"),
  // Sprints
  def("SPRINTS_CREATE", "sprints.create", "sprints", "Create sprints"),
  def("SPRINTS_MANAGE", "sprints.manage", "sprints", "Edit, start and close sprints"),
  // Daily updates
  def(
    "DAILY_UPDATES_CREATE_OWN",
    "daily_updates.create_own",
    "daily_updates",
    "Write your own daily update",
  ),
  def(
    "DAILY_UPDATES_VIEW_ALL",
    "daily_updates.view_all",
    "daily_updates",
    "See everyone's daily updates (Today feed)",
  ),
  def(
    "DAILY_UPDATES_EDIT_ANY",
    "daily_updates.edit_any",
    "daily_updates",
    "Edit anyone's daily update",
  ),
  // Project Docs
  def("DOCS_CREATE", "docs.create", "docs", "Create project docs"),
  def("DOCS_EDIT_ANY", "docs.edit_any", "docs", "Edit anyone's project docs"),
  def("DOCS_DELETE", "docs.delete", "docs", "Delete project docs"),
  // Reporting
  def("REPORTING_VIEW", "reporting.view", "reporting", "View reports for your own work"),
  def("REPORTING_VIEW_ALL", "reporting.view_all", "reporting", "View workspace-wide reports"),
  def("REPORTING_EXPORT", "reporting.export", "reporting", "Export reports"),
  // Integrations, automations, import
  def("INTEGRATIONS_CONNECT", "integrations.connect", "integrations", "Connect an integration"),
  def(
    "INTEGRATIONS_DISCONNECT",
    "integrations.disconnect",
    "integrations",
    "Disconnect an integration",
  ),
  def(
    "AUTOMATIONS_MANAGE",
    "automations.manage",
    "integrations",
    "Create and manage automation rules",
  ),
  def("INTEGRATIONS_IMPORT", "integrations.import", "integrations", "Import from Jira / ClickUp"),
  // AI
  def("AI_USE", "ai.use", "ai", "Use AI features (Ask Your Workspace, briefs)"),
  def("AI_MANAGE_BUDGETS", "ai.manage_budgets", "ai", "Set AI spend caps per workspace"),
  // Time tracking
  def("TIME_VIEW_ALL", "time.view_all", "time", "See everyone's logged time"),
];

export const ALL_PERMISSION_KEYS = PERMISSION_CATALOG.map((p) => p.key);

export type PermissionKey = (typeof ALL_PERMISSION_KEYS)[number];

export const PERMISSION_KEY_SET = new Set<string>(ALL_PERMISSION_KEYS);

export function isPermissionKey(value: string): value is PermissionKey {
  return PERMISSION_KEY_SET.has(value);
}

/** Catalog grouped by area, in display order — what GET /permissions returns. */
export function groupedPermissionCatalog(): {
  area: PermissionArea;
  permissions: PermissionDefinition[];
}[] {
  return PERMISSION_AREAS.map((area) => ({
    area,
    permissions: PERMISSION_CATALOG.filter((p) => p.area === area),
  }));
}

export const SYSTEM_ROLE_NAMES = ["OWNER", "ADMIN", "LEAD", "MEMBER", "VIEWER"] as const;
export type SystemRoleName = (typeof SYSTEM_ROLE_NAMES)[number];

/**
 * System-role defaults, seeded per workspace (SYSTEM-DESIGN.md §2.1).
 * These are DEFAULTS only: a workspace admin may toggle any of them
 * afterwards, including on a system role. There is no implicit "admin
 * can do everything" in code — even OWNER's powers come from its
 * granted keys (it is seeded with all of them).
 */
export const SYSTEM_ROLE_DEFAULTS: Record<SystemRoleName, PermissionKey[]> = {
  OWNER: [...ALL_PERMISSION_KEYS] as PermissionKey[],
  ADMIN: ALL_PERMISSION_KEYS.filter((k) => k !== "BILLING_MANAGE") as PermissionKey[],
  LEAD: [
    "PROJECTS_VIEW_ALL",
    "BOARDS_CREATE",
    // tickets.* except TICKETS_DELETE
    "TICKETS_CREATE",
    "TICKETS_VIEW_ALL",
    "TICKETS_EDIT_OWN",
    "TICKETS_EDIT_ANY",
    "TICKETS_ASSIGN",
    "TICKETS_MOVE_STATUS",
    "TICKETS_COMMENT",
    "TICKETS_ATTACH",
    "SPRINTS_CREATE",
    "SPRINTS_MANAGE",
    "DAILY_UPDATES_VIEW_ALL",
    "DOCS_CREATE",
    "REPORTING_VIEW_ALL",
    "AI_USE",
    "TIME_VIEW_ALL",
    "MEMBERS_INVITE",
    "TEAMS_MANAGE",
  ],
  MEMBER: [
    "TICKETS_CREATE",
    "TICKETS_EDIT_OWN",
    "TICKETS_MOVE_STATUS",
    "TICKETS_COMMENT",
    "TICKETS_ATTACH",
    "DAILY_UPDATES_CREATE_OWN",
    "DOCS_CREATE",
    "REPORTING_VIEW",
    "AI_USE",
    // Own connections only — a member connecting Slack for themselves
    // is not a workspace connection.
    "INTEGRATIONS_CONNECT",
  ],
  VIEWER: [
    "WORKSPACE_VIEW_SETTINGS",
    "PROJECTS_VIEW_ALL",
    "TICKETS_VIEW_ALL",
    "DAILY_UPDATES_VIEW_ALL",
    "REPORTING_VIEW",
  ],
};
