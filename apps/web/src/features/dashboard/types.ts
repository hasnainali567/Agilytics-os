import type { DashboardSummary } from "@agilytics/shared";

/** Widget types from the registry (FRONTEND.md §1B). One file per type. */
export type WidgetType =
  "kpi" | "velocity" | "workload" | "today-feed" | "blockers" | "at-risk" | "my-work" | "ai-brief";

export const WIDGET_TYPES: WidgetType[] = [
  "kpi",
  "velocity",
  "workload",
  "today-feed",
  "blockers",
  "at-risk",
  "my-work",
  "ai-brief",
];

export type RoleTemplate = "manager" | "lead" | "developer" | "viewer";

/** Per-widget config — stats shown, scope, time range (FRONTEND.md §1B). */
export interface WidgetConfig {
  /** KPI stat key: "velocity" | "done" | "overdue" | "at-risk" | "projects". */
  stat?: string;
  projectId?: string;
  sprintId?: string;
  teamId?: string;
  timeRange?: "4w" | "6w" | "12w";
}

/** One widget on the 12-column grid. x/y are row-major packed positions. */
export interface WidgetPlacement {
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  /** Width in grid columns (1–12). */
  w: number;
  /** Height in grid rows (1–6). */
  h: number;
  config: WidgetConfig;
}

export interface UiPrefs {
  density: "comfortable" | "compact";
  sidebarCollapsed: boolean;
  /** Nav item ids the user chose to show; hiding one never hides its route. */
  navItems: string[];
}

export interface DashboardLayoutData {
  widgets: WidgetPlacement[];
  ui: UiPrefs;
}

export interface SavedLayoutResponse {
  id: string | null;
  name: string;
  layout: DashboardLayoutData;
  template: string | null;
  isDefault: boolean;
  persisted: boolean;
}

export interface WidgetProps {
  summary: DashboardSummary;
  config: WidgetConfig;
  /** Clear the widget's scope — used by the scoped empty state. */
  onClearScope: () => void;
}
