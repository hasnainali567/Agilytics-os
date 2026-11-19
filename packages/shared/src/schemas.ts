import { z } from "zod";

/** Every row in the system belongs to one organisation (tenant). */
export const tenantIdSchema = z.uuid();
export const idSchema = z.uuid();

export const memberRoleSchema = z.enum(["OWNER", "ADMIN", "LEAD", "MEMBER", "VIEWER"]);
export type MemberRole = z.infer<typeof memberRoleSchema>;

export const organisationSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(120),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createOrganisationSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/),
});

export const userSchema = z.object({
  id: idSchema,
  email: z.email(),
  name: z.string().min(1).max(120),
  avatarUrl: z.url().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const membershipSchema = z.object({
  id: idSchema,
  tenantId: tenantIdSchema,
  userId: idSchema,
  role: memberRoleSchema,
  createdAt: z.date(),
});

export const teamSchema = z.object({
  id: idSchema,
  tenantId: tenantIdSchema,
  name: z.string().min(1).max(120),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export const createTeamSchema = teamSchema.pick({ name: true });

export const projectStatusSchema = z.enum(["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]);
export const projectSchema = z.object({
  id: idSchema,
  tenantId: tenantIdSchema,
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  status: projectStatusSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});
export const createProjectSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  teamIds: z.array(idSchema).optional(),
});

export const sprintStatusSchema = z.enum(["PLANNED", "ACTIVE", "COMPLETED"]);
export const sprintSchema = z.object({
  id: idSchema,
  tenantId: tenantIdSchema,
  projectId: idSchema,
  name: z.string().min(1).max(120),
  goal: z.string().max(1000).optional(),
  startDate: z.date(),
  endDate: z.date(),
  status: sprintStatusSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});
export const createSprintSchema = z.object({
  projectId: idSchema,
  name: z.string().min(1).max(120),
  goal: z.string().max(1000).optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

/**
 * Reporting category of a board column. The column NAME is free text
 * (workspace admin's choice); only the category drives reporting.
 * There is deliberately no fixed ticket-status enum in v2.
 */
export const columnCategorySchema = z.enum(["TODO", "IN_PROGRESS", "DONE"]);
export type ColumnCategory = z.infer<typeof columnCategorySchema>;

export const boardColumnSchema = z.object({
  id: idSchema,
  tenantId: tenantIdSchema,
  boardId: idSchema,
  name: z.string().min(1).max(80),
  order: z.number().int().min(0),
  colour: z.string().max(16),
  category: columnCategorySchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});
export const createBoardColumnSchema = z.object({
  name: z.string().min(1).max(80),
  order: z.number().int().min(0).optional(),
  colour: z.string().max(16).optional(),
  category: columnCategorySchema.default("TODO"),
});
export const updateBoardColumnSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  order: z.number().int().min(0).optional(),
  colour: z.string().max(16).optional(),
  category: columnCategorySchema.optional(),
});

export const boardSchema = z.object({
  id: idSchema,
  tenantId: tenantIdSchema,
  projectId: idSchema,
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  isDefault: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export const createBoardSchema = z.object({
  projectId: idSchema,
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
});

/**
 * Default board template applied on project creation — a starting point
 * only, fully editable by the workspace admin (rename, reorder, add,
 * remove). Names are free text; categories are what reporting reads.
 */
export const DEFAULT_BOARD_TEMPLATE: { name: string; category: ColumnCategory; colour: string }[] =
  [
    { name: "Backlog", category: "TODO", colour: "#64748B" },
    { name: "To Do", category: "TODO", colour: "#3B82F6" },
    { name: "In Progress", category: "IN_PROGRESS", colour: "#F59E0B" },
    { name: "Review", category: "IN_PROGRESS", colour: "#8B5CF6" },
    { name: "Done", category: "DONE", colour: "#22C55E" },
  ];

export const updateHealthSchema = z.enum(["ON_TRACK", "AT_RISK", "BLOCKED"]);
export type UpdateHealth = z.infer<typeof updateHealthSchema>;

export const dailyUpdateSchema = z.object({
  id: idSchema,
  tenantId: tenantIdSchema,
  ticketId: idSchema,
  memberId: idSchema,
  date: z.date(),
  doneToday: z.string().min(1).max(2000),
  next: z.string().max(2000).optional(),
  blockers: z.string().max(2000).optional(),
  hasBlocker: z.boolean(),
  progressPercent: z.number().int().min(0).max(100).nullable(),
  health: updateHealthSchema,
  timeSpentMin: z.number().int().min(0).max(1440).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export const createDailyUpdateSchema = z.object({
  doneToday: z.string().min(1).max(2000),
  next: z.string().max(2000).optional(),
  blockers: z.string().max(2000).optional(),
  hasBlocker: z.boolean().default(false),
  progressPercent: z.number().int().min(0).max(100).optional(),
  health: updateHealthSchema.default("ON_TRACK"),
  timeSpentMin: z.number().int().min(0).max(1440).optional(),
});

export const ticketPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
export const ticketSchema = z.object({
  id: idSchema,
  tenantId: tenantIdSchema,
  projectId: idSchema,
  sprintId: idSchema.nullable(),
  boardId: idSchema.nullable(),
  /** Status is a BoardColumn id — never a fixed enum (see boardColumnSchema). */
  statusId: idSchema.nullable(),
  title: z.string().min(1).max(240),
  description: z.string().max(5000).optional(),
  priority: ticketPrioritySchema,
  /** Story points / estimate — the field v1 never had, so velocity was count-based. */
  estimate: z.number().int().min(0).max(100).nullable(),
  assigneeId: idSchema.nullable(),
  dueDate: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export const createTicketSchema = z.object({
  projectId: idSchema,
  sprintId: idSchema.optional(),
  boardId: idSchema.optional(),
  statusId: idSchema.optional(),
  title: z.string().min(1).max(240),
  description: z.string().max(5000).optional(),
  priority: ticketPrioritySchema.default("MEDIUM"),
  estimate: z.number().int().min(0).max(100).optional(),
  assigneeId: idSchema.optional(),
  dueDate: z.coerce.date().optional(),
});
export const updateTicketStatusSchema = z.object({
  statusId: idSchema,
  note: z.string().max(500).optional(),
});

// --- Automations (Phase 2, trigger → action) ---
// The catalog is data-driven: adding a trigger/action is one entry here
// (+ one executor branch in AutomationService). The API validates
// trigger/action against these enums; the web rule builder renders
// its dropdowns and per-action config fields from the catalogs below.

export const AUTOMATION_TRIGGERS = [
  "ticket.created",
  "ticket.status_changed",
  "ticket.overdue",
  "ticket.done",
  "sprint.completed",
  "daily_update.created",
  "comment.created",
] as const;
export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number];
export const automationTriggerSchema = z.enum(AUTOMATION_TRIGGERS);

export const AUTOMATION_ACTIONS = [
  "slack.post",
  "github.comment",
  "notification.create",
  "ticket.update",
  "webhook.post",
] as const;
export type AutomationAction = (typeof AUTOMATION_ACTIONS)[number];
export const automationActionSchema = z.enum(AUTOMATION_ACTIONS);

/** Rule config is free-form JSON; known keys are documented per action
 *  in AUTOMATION_ACTION_CATALOG. `filters` narrows when a rule fires. */
export const automationRuleConfigSchema = z
  .record(z.string(), z.unknown())
  .default({});

export const createAutomationRuleSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    trigger: automationTriggerSchema,
    action: automationActionSchema,
    config: automationRuleConfigSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.action === "webhook.post") {
      const url = (v.config as Record<string, unknown> | undefined)?.["url"];
      if (typeof url !== "string" || !/^https?:\/\//.test(url)) {
        ctx.addIssue({
          code: "custom",
          message: "webhook.post requires config.url to be an http(s) URL",
          path: ["config", "url"],
        });
      }
    }
  });

export const updateAutomationRuleSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  trigger: automationTriggerSchema.optional(),
  action: automationActionSchema.optional(),
  config: automationRuleConfigSchema.optional(),
  isActive: z.boolean().optional(),
});

export const automationRuleSchema = z.object({
  id: idSchema,
  tenantId: tenantIdSchema,
  name: z.string().min(1).max(100),
  trigger: automationTriggerSchema,
  action: automationActionSchema,
  config: automationRuleConfigSchema,
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type AutomationRule = z.infer<typeof automationRuleSchema>;
export type CreateAutomationRuleInput = z.infer<typeof createAutomationRuleSchema>;
export type UpdateAutomationRuleInput = z.infer<typeof updateAutomationRuleSchema>;

export interface AutomationConfigField {
  key: string;
  label: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  type?: "text" | "textarea" | "select";
  options?: { value: string; label: string }[];
}

export const AUTOMATION_TRIGGER_CATALOG: {
  trigger: AutomationTrigger;
  label: string;
  description: string;
}[] = [
  { trigger: "ticket.created", label: "Ticket created", description: "A ticket is created in the workspace." },
  { trigger: "ticket.status_changed", label: "Ticket status changed", description: "A ticket moves to another workflow column. Narrow with a to-category filter." },
  { trigger: "ticket.overdue", label: "Ticket overdue / stale", description: "A ticket has no daily update in 3 days (overdue sweep)." },
  { trigger: "ticket.done", label: "Ticket done", description: "A ticket moves into a Done-category column." },
  { trigger: "sprint.completed", label: "Sprint completed", description: "A sprint is marked completed." },
  { trigger: "daily_update.created", label: "Daily update created", description: "A member posts a daily update." },
  { trigger: "comment.created", label: "Comment created", description: "A comment is posted on a ticket." },
];

export const AUTOMATION_ACTION_CATALOG: {
  action: AutomationAction;
  label: string;
  description: string;
  configFields: AutomationConfigField[];
}[] = [
  {
    action: "slack.post",
    label: "Post to Slack",
    description: "Post a message to a channel. Skipped with a warning when Slack is not connected.",
    configFields: [
      { key: "channel", label: "Channel", placeholder: "#agilytics", hint: "Defaults to SLACK_DEFAULT_CHANNEL when empty." },
      { key: "template", label: "Message template", placeholder: "Ticket {ticket.key}: {ticket.title}", hint: "Placeholders: {ticket.key} {ticket.title} {trigger} {assigneeId}. Empty = built-in alert.", type: "textarea" },
    ],
  },
  {
    action: "github.comment",
    label: "Comment on GitHub PR",
    description: "Comment on the linked pull request. Needs owner, repo and PR number in the config.",
    configFields: [
      { key: "owner", label: "Repo owner", placeholder: "octocat", required: true },
      { key: "repo", label: "Repository", placeholder: "hello-world", required: true },
      { key: "prNumber", label: "PR number", placeholder: "12", required: true },
      { key: "template", label: "Comment template", placeholder: "Ticket {ticket.key} is done.", hint: "Same placeholders as Slack.", type: "textarea" },
    ],
  },
  {
    action: "notification.create",
    label: "Create notification",
    description: "Write an inbox notification for the ticket assignee (or the user in config).",
    configFields: [
      { key: "message", label: "Message", placeholder: "Your ticket is overdue — please post an update.", type: "textarea" },
      { key: "userId", label: "Notify user id (optional)", placeholder: "user id — defaults to the assignee", hint: "Leave empty to notify the ticket assignee." },
    ],
  },
  {
    action: "ticket.update",
    label: "Update ticket",
    description: "Set the ticket's status category, priority and/or assignee.",
    configFields: [
      { key: "statusCategory", label: "Move to status category", type: "select", options: [{ value: "", label: "— keep —" }, { value: "TODO", label: "To Do" }, { value: "IN_PROGRESS", label: "In Progress" }, { value: "DONE", label: "Done" }] },
      { key: "priority", label: "Priority", type: "select", options: [{ value: "", label: "— keep —" }, { value: "LOW", label: "Low" }, { value: "MEDIUM", label: "Medium" }, { value: "HIGH", label: "High" }, { value: "URGENT", label: "Urgent" }] },
      { key: "assigneeId", label: "Assignee user id (optional)", placeholder: "user id" },
    ],
  },
  {
    action: "webhook.post",
    label: "POST to webhook URL",
    description: "POST the event JSON to any URL — the generic escape hatch (Zapier / Make / anything).",
    configFields: [
      { key: "url", label: "Webhook URL", placeholder: "https://hooks.example.com/agilytics", required: true },
      { key: "template", label: "Message template (optional)", placeholder: "Ticket {ticket.key}: {ticket.title}", hint: "Sent as { text } alongside the event JSON. Empty = event JSON only.", type: "textarea" },
    ],
  },
];

export type Organisation = z.infer<typeof organisationSchema>;
export type User = z.infer<typeof userSchema>;
export type Membership = z.infer<typeof membershipSchema>;
export type Team = z.infer<typeof teamSchema>;
export type Project = z.infer<typeof projectSchema>;
export type ProjectStatus = z.infer<typeof projectStatusSchema>;
export type Sprint = z.infer<typeof sprintSchema>;
export type SprintStatus = z.infer<typeof sprintStatusSchema>;
export type Ticket = z.infer<typeof ticketSchema>;
export type TicketPriority = z.infer<typeof ticketPrioritySchema>;
export type BoardColumn = z.infer<typeof boardColumnSchema>;
export type Board = z.infer<typeof boardSchema>;
export type DailyUpdate = z.infer<typeof dailyUpdateSchema>;
