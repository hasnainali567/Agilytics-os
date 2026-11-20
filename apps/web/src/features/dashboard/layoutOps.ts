import type { DashboardLayoutData, WidgetConfig, WidgetPlacement, WidgetType } from "./types";

/** Pure layout operations — no React, no network, unit-tested via templates tests. */

export function sortByPosition(widgets: WidgetPlacement[]): WidgetPlacement[] {
  return [...widgets].sort((a, b) => a.y - b.y || a.x - b.x);
}

/**
 * Row-major packing: widgets keep their array order and get fresh
 * x/y on the 12-column grid. Order is the source of truth; x/y are
 * derived. The grid renders in a FIXED order (see DashboardGrid), so
 * pack only keeps the saved record valid for the API (unique ids,
 * in-bounds x/y/w/h) — it no longer drives placement.
 */
export function pack(widgets: WidgetPlacement[]): WidgetPlacement[] {
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  return widgets.map((w) => {
    if (x + w.w > 12) {
      x = 0;
      y += rowHeight;
      rowHeight = 0;
    }
    const placed = { ...w, x, y };
    x += w.w;
    rowHeight = Math.max(rowHeight, w.h);
    return placed;
  });
}

export function addWidget(
  layout: DashboardLayoutData,
  type: WidgetType,
  config: WidgetConfig = {},
): DashboardLayoutData {
  // Default sizes match the FIXED Kanban spans (see DashboardGrid) so
  // a saved record stays consistent even though render ignores w/h.
  const defaults: Record<WidgetType, { w: number; h: number }> = {
    kpi: { w: 3, h: 1 },
    velocity: { w: 8, h: 2 },
    workload: { w: 4, h: 2 },
    "today-feed": { w: 4, h: 2 },
    blockers: { w: 8, h: 2 },
    "at-risk": { w: 6, h: 2 },
    "my-work": { w: 6, h: 2 },
    "ai-brief": { w: 12, h: 1 },
  };
  const { w, h } = defaults[type];
  const placed: WidgetPlacement = {
    id: `${type}-${Date.now().toString(36)}`,
    type,
    x: 0,
    y: 0,
    w,
    h,
    config,
  };
  return { ...layout, widgets: pack([...layout.widgets, placed]) };
}

export function removeWidget(layout: DashboardLayoutData, id: string): DashboardLayoutData {
  return { ...layout, widgets: pack(layout.widgets.filter((w) => w.id !== id)) };
}

export function updateWidgetConfig(
  layout: DashboardLayoutData,
  id: string,
  config: WidgetConfig,
): DashboardLayoutData {
  return {
    ...layout,
    widgets: layout.widgets.map((w) => (w.id === id ? { ...w, config } : w)),
  };
}
