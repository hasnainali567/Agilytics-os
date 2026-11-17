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
