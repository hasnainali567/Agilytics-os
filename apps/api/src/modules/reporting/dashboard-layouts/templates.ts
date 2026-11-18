import type { DashboardLayoutJson, RoleTemplate, WidgetPlacement } from "./dashboard-layout.schema";

/**
 * Role templates — seed a new user's FIRST layout only (decision 20).
 * After that the layout is the user's own. Same widget set and grid
 * positions as the web templates in features/dashboard/templates.ts;
 * the server is the source of truth for the GET default, the web copy
 * is for applying a template client-side before the first save.
 * Grid is 12 columns; w = columns, h = rows. The Manager template is
 * the Executive Dashboard default: KPI row, then the Agibankz bottom
 * 3 columns (Workload donut / Velocity progress bars / Today feed).
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

function layout(widgets: WidgetPlacement[], navItems: string[] = NAV_ALL): DashboardLayoutJson {
  return {
    widgets,
    ui: { density: "comfortable", sidebarCollapsed: false, navItems },
  };
}

export const ROLE_TEMPLATES: Record<RoleTemplate, DashboardLayoutJson> = {
  manager: layout([
    widget("hero-kpi", "kpi", 0, 0, 4, 1, { stat: "velocity" }),
    widget("hero-done", "kpi", 4, 0, 4, 1, { stat: "done" }),
    widget("hero-risk", "kpi", 8, 0, 4, 1, { stat: "at-risk" }),
    widget("workload", "workload", 0, 1, 4, 2),
    widget("velocity", "velocity", 4, 1, 4, 2, { timeRange: "6w" }),
    widget("today", "today-feed", 8, 1, 4, 2),
    widget("blockers", "blockers", 0, 3, 6, 2),
    widget("at-risk", "at-risk", 6, 3, 6, 2),
    widget("ai-brief", "ai-brief", 0, 5, 12, 1),
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

/** Membership role → seed template. Unknown / missing membership → developer. */
export function templateForMembershipRole(role?: string | null): RoleTemplate {
  switch (role) {
    case "OWNER":
    case "ADMIN":
      return "manager";
    case "LEAD":
      return "lead";
    case "VIEWER":
      return "viewer";
    default:
      return "developer";
  }
}

export function defaultLayoutFor(template: RoleTemplate): DashboardLayoutJson {
  // Structured clone so callers can mutate the returned layout safely.
  return JSON.parse(JSON.stringify(ROLE_TEMPLATES[template])) as DashboardLayoutJson;
}
