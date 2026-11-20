import type { DashboardLayoutData, RoleTemplate, WidgetPlacement } from "./types";

/**
 * Role templates — client-side copy of the server templates
 * (apps/api/src/modules/reporting/dashboard-layouts/templates.ts).
 * The server is the source of truth for the GET default; this copy is
 * for applying a template client-side before the first save. Keep the
 * two in sync: same widget ids, types, positions and sizes.
 */

const NAV_ALL = [
  "dashboard",
  "projects",
  "boards",
  "sprints",
  "reports",
  "docs",
  "connections",
  "automations",
  "ai",
  "admin",
];

function widget(
  id: string,
  type: WidgetPlacement["type"],
  x: number,
  y: number,
  w: number,
  h: number,
  config: WidgetPlacement["config"] = {},
): WidgetPlacement {
  return { id, type, x, y, w, h, config };
}

function layout(widgets: WidgetPlacement[], navItems: string[] = NAV_ALL): DashboardLayoutData {
  return {
    widgets,
    ui: { density: "comfortable", sidebarCollapsed: false, navItems },
  };
}

export const ROLE_TEMPLATES: Record<RoleTemplate, DashboardLayoutData> = {
  // Manager = the fixed Kanban structure (locked 2026-11-19): 4 KPI
  // cards in one row, then wide (8) + narrow (4) rows. Positions are
  // stored for the API record only — DashboardGrid renders in this
  // fixed order and ignores x/y/w/h. The server copy
  // (apps/api/.../dashboard-layouts/templates.ts) is synced to the
  // same structure.
  manager: layout([
    widget("hero-kpi", "kpi", 0, 0, 3, 1, { stat: "velocity" }),
    widget("hero-done", "kpi", 3, 0, 3, 1, { stat: "done" }),
    widget("hero-risk", "kpi", 6, 0, 3, 1, { stat: "at-risk" }),
    widget("hero-overdue", "kpi", 9, 0, 3, 1, { stat: "overdue" }),
    widget("velocity", "velocity", 0, 1, 8, 2, { timeRange: "6w" }),
    widget("today", "today-feed", 8, 1, 4, 2),
    widget("blockers", "blockers", 0, 3, 8, 2),
    widget("workload", "workload", 8, 3, 4, 2),
    widget("at-risk", "at-risk", 0, 5, 6, 2),
    widget("my-work", "my-work", 6, 5, 6, 2),
    widget("ai-brief", "ai-brief", 0, 7, 12, 1),
  ]),
  lead: layout([
    widget("hero-kpi", "kpi", 0, 0, 6, 1, { stat: "velocity" }),
    widget("hero-done", "kpi", 6, 0, 6, 1, { stat: "done" }),
    widget("today", "today-feed", 0, 1, 6, 2),
    widget("blockers", "blockers", 6, 1, 6, 2),
    widget("velocity", "velocity", 0, 3, 8, 2, { timeRange: "6w" }),
    widget("workload", "workload", 8, 3, 4, 2),
    widget("my-work", "my-work", 0, 5, 12, 2),
  ]),
  developer: layout([
    widget("my-work", "my-work", 0, 0, 12, 2),
    widget("today", "today-feed", 0, 2, 6, 2),
    widget("blockers", "blockers", 6, 2, 6, 2),
    widget("hero-kpi", "kpi", 0, 4, 6, 1, { stat: "done" }),
    widget("hero-overdue", "kpi", 6, 4, 6, 1, { stat: "overdue" }),
  ]),
  viewer: layout(
    [
      widget("hero-kpi", "kpi", 0, 0, 6, 1, { stat: "velocity" }),
      widget("hero-done", "kpi", 6, 0, 6, 1, { stat: "done" }),
      widget("velocity", "velocity", 0, 1, 12, 2, { timeRange: "6w" }),
      widget("today", "today-feed", 0, 3, 12, 2),
    ],
    ["dashboard", "projects", "reports"],
  ),
};

export function defaultLayoutFor(template: RoleTemplate): DashboardLayoutData {
  return JSON.parse(JSON.stringify(ROLE_TEMPLATES[template])) as DashboardLayoutData;
}
