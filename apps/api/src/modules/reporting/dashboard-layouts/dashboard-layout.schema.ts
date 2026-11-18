import { z } from "zod";

/**
 * Dashboard layout JSON — validated here, in the API module, not in
 * @agilytics/shared (layout shape is a reporting concern; the shared
 * package is owned by another slice). Mirrors schema.prisma
 * DashboardLayout.layout and docs/FRONTEND.md §1B.
 *
 * A widget with a scope the reporting API cannot break down (project /
 * sprint / team) is stored as-is; the frontend renders it as an empty
 * state with a "re-pick scope" action, never as another scope's data.
 * Unknown extra fields inside a widget config are stripped on save.
 */
export const widgetTypes = [
  "kpi",
  "velocity",
  "workload",
  "today-feed",
  "blockers",
  "at-risk",
  "my-work",
  "ai-brief",
] as const;

export type WidgetType = (typeof widgetTypes)[number];

export const roleTemplates = ["manager", "lead", "developer", "viewer"] as const;

export type RoleTemplate = (typeof roleTemplates)[number];

export const widgetConfigSchema = z.object({
  /** Which stat a KPI widget shows, e.g. "velocity" | "done" | "overdue" | "at-risk". */
  stat: z.string().max(40).optional(),
  projectId: z.string().uuid().optional(),
  sprintId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
  timeRange: z.enum(["4w", "6w", "12w"]).optional(),
});

export const widgetPlacementSchema = z.object({
  id: z.string().min(1).max(80),
  type: z.enum(widgetTypes),
  x: z.number().int().min(0).max(11),
  y: z.number().int().min(0),
  /** Width in grid columns (12-column grid). */
  w: z.number().int().min(1).max(12),
  /** Height in grid rows. */
  h: z.number().int().min(1).max(6),
  config: widgetConfigSchema.default({}),
});

export const uiPrefsSchema = z.object({
  density: z.enum(["comfortable", "compact"]).default("comfortable"),
  sidebarCollapsed: z.boolean().default(false),
  /** Nav item ids the user chose to show; hiding one never hides its route. */
  navItems: z.array(z.string().max(40)).default([]),
});

export const dashboardLayoutSchema = z
  .object({
    widgets: z.array(widgetPlacementSchema).min(1).max(24),
    ui: uiPrefsSchema.default({
      density: "comfortable",
      sidebarCollapsed: false,
      navItems: [],
    }),
  })
  .refine((layout) => new Set(layout.widgets.map((w) => w.id)).size === layout.widgets.length, {
    message: "Widget ids must be unique",
  });

export type DashboardLayoutJson = z.infer<typeof dashboardLayoutSchema>;
export type WidgetPlacement = z.infer<typeof widgetPlacementSchema>;
export type WidgetConfig = z.infer<typeof widgetConfigSchema>;
export type UiPrefs = z.infer<typeof uiPrefsSchema>;

export const saveLayoutSchema = z.object({
  name: z.string().min(1).max(80).default("default"),
  layout: dashboardLayoutSchema,
  template: z.enum(roleTemplates).optional(),
});

export const resetLayoutSchema = z.object({
  name: z.string().min(1).max(80).default("default"),
  template: z.enum(roleTemplates).optional(),
});
