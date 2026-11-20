import type { ComponentType } from "react";
import type { WidgetProps, WidgetType } from "./types";
import { AiBriefWidget } from "./widgets/AiBriefWidget";
import { AtRiskWidget } from "./widgets/AtRiskWidget";
import { BlockersWidget } from "./widgets/BlockersWidget";
import { KpiWidget } from "./widgets/KpiWidget";
import { MyWorkWidget } from "./widgets/MyWorkWidget";
import { TodayFeedWidget } from "./widgets/TodayFeedWidget";
import { VelocityWidget } from "./widgets/VelocityWidget";
import { WorkloadWidget } from "./widgets/WorkloadWidget";

/**
 * Widget registry — one component per widget type, all built from the
 * shared Kanban primitives (FRONTEND.md §1B). A custom dashboard
 * still looks like Agilytics because every widget renders through
 * this registry; there is no other way to put a card on the grid.
 */
export interface WidgetDefinition {
  title: string;
  description: string;
  defaultSize: { w: number; h: number };
  component: ComponentType<WidgetProps>;
}

export const WIDGET_REGISTRY: Record<WidgetType, WidgetDefinition> = {
  kpi: {
    title: "KPI card",
    description: "One stat + trend (velocity, done, overdue, at-risk…).",
    defaultSize: { w: 3, h: 1 },
    component: KpiWidget,
  },
  velocity: {
    title: "Velocity chart",
    description: "Points entering Done per week, with time range.",
    defaultSize: { w: 8, h: 2 },
    component: VelocityWidget,
  },
  workload: {
    title: "Workload donut",
    description: "Workload by member, as a donut.",
    defaultSize: { w: 4, h: 2 },
    component: WorkloadWidget,
  },
  "today-feed": {
    title: "Today feed",
    description: "Who updated, who is silent, open blockers.",
    defaultSize: { w: 4, h: 2 },
    component: TodayFeedWidget,
  },
  blockers: {
    title: "Blockers list",
    description: "Open blockers and stale tickets.",
    defaultSize: { w: 8, h: 2 },
    component: BlockersWidget,
  },
  "at-risk": {
    title: "At-risk list",
    description: "At-risk members, from Daily Updates + stale.",
    defaultSize: { w: 6, h: 2 },
    component: AtRiskWidget,
  },
  "my-work": {
    title: "My Work",
    description: "Assigned to me, due today / overdue, blocked.",
    defaultSize: { w: 6, h: 2 },
    component: MyWorkWidget,
  },
  "ai-brief": {
    title: "AI brief",
    description: "Daily brief / risk list (Phase 3 data; slot only).",
    defaultSize: { w: 12, h: 1 },
    component: AiBriefWidget,
  },
};

export function isWidgetType(value: string): value is WidgetType {
  return value in WIDGET_REGISTRY;
}
