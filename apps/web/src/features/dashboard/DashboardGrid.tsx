import type { DashboardSummary } from "@agilytics/shared";
import { useState } from "react";
import { WIDGET_REGISTRY } from "./registry";
import { defaultLayoutFor } from "./templates";
import { useDashboardLayout } from "./useDashboardLayout";
import { WidgetConfigPanel } from "./WidgetConfigPanel";
import { WidgetShell } from "./WidgetShell";
import { WIDGET_TYPES, type WidgetType } from "./types";

/**
 * Fixed dashboard grid (FRONTEND.md §1B; Kanban main design, locked
 * 2026-11-19): the layout is NOT customisable — no drag to swap, no
 * resize, no templates, no dnd-kit. Widgets always render in this
 * order, at these spans, on the 12-column grid:
 *
 *   KPI cards (4 × 3 cols) — velocity, done, at-risk, overdue
 *   Velocity (8) + Today feed (4)
 *   Blockers (8) + Workload donut (4)
 *   At-risk (6) + My Work (6)
 *   AI brief (12)
 *
 * What IS customisable is visibility: the "Customise" panel lists one
 * toggle per widget type, and the visible set is saved per user through
 * the existing dashboard-layout API (PUT /dashboard/layout). The saved
 * record is just the list of visible widgets — their stored x/y/w/h
 * are ignored on render, so an older saved layout still renders in
 * the fixed structure. Changes auto-save (debounced) through
 * useDashboardLayout.
 *
 * If the saved layout cannot load (e.g. the layout module is not
 * wired into AppModule yet), the grid falls back to the Manager
 * template read-only — the dashboard still renders, customisation
 * just waits for the API.
 */
const FIXED_SPAN: Record<WidgetType, number> = {
  kpi: 3,
  velocity: 8,
  workload: 4,
  "today-feed": 4,
  blockers: 8,
  "at-risk": 6,
  "my-work": 6,
  "ai-brief": 12,
};

const FIXED_ORDER: WidgetType[] = [
  "kpi",
  "velocity",
  "today-feed",
  "blockers",
  "workload",
  "at-risk",
  "my-work",
  "ai-brief",
];

export function DashboardGrid({
  summary,
  editing,
}: {
  summary: DashboardSummary;
  editing: boolean;
}) {
  const layoutApi = useDashboardLayout();
  const [configuringId, setConfiguringId] = useState<string | null>(null);

  // Server layout when available, Manager template fallback on error.
  const layout = layoutApi.layout ?? (layoutApi.isError ? defaultLayoutFor("manager") : null);
  const readOnly = layoutApi.isError;
  const canEdit = editing && !readOnly;

  if (layoutApi.isPending || !layout) {
    return (
      <p className="rounded-card border border-line bg-white p-6 text-sm text-muted">
        Loading your dashboard…
      </p>
    );
  }

  const configuring = layout.widgets.find((w) => w.id === configuringId) ?? null;
  const visibleTypes = new Set(layout.widgets.map((w) => w.type));
  // Fixed Kanban order; within a type (the four KPI cards) keep the
  // saved order. Stored x/y/w/h are ignored — the grid is fixed.
  const ordered = [...layout.widgets].sort(
    (a, b) => FIXED_ORDER.indexOf(a.type) - FIXED_ORDER.indexOf(b.type),
  );

  return (
    <section aria-label="My dashboard">
      {readOnly && (
        <p className="mb-4 rounded-card border border-line bg-white p-4 text-sm text-muted">
          Your saved layout couldn&apos;t load — showing the default Manager layout until the API is
          reachable. Customising is paused, not lost.
        </p>
      )}
      {canEdit && (
        <div className="mb-4 rounded-card border border-line bg-white p-5 shadow-[0_1px_2px_rgba(17,24,39,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink">Choose widgets</h3>
            <span className="flex items-center gap-2">
              {layoutApi.isSaving && <span className="text-xs text-muted">Saving…</span>}
              <button
                type="button"
                onClick={() => layoutApi.reset()}
                disabled={layoutApi.isResetting}
                className="rounded-[10px] border border-line bg-white px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-pill disabled:opacity-50"
              >
                Reset to default
              </button>
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">
            Pick what shows on your dashboard. The layout itself is fixed — widgets always
            appear in the same places.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {WIDGET_TYPES.map((type) => (
              <label
                key={type}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-[#6C5CE7] has-checked:border-[#6C5CE7] has-checked:bg-[#EFEAFE]"
              >
                <input
                  type="checkbox"
                  checked={visibleTypes.has(type)}
                  onChange={(e) => layoutApi.setWidgetVisible(type, e.target.checked)}
                  aria-label={`Show ${WIDGET_REGISTRY[type].title}`}
                />
                {WIDGET_REGISTRY[type].title}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-5">
        {ordered.map((placement) => {
          const def = WIDGET_REGISTRY[placement.type];
          const Widget = def.component;
          return (
            <WidgetShell
              key={placement.id}
              title={def.title}
              span={FIXED_SPAN[placement.type]}
              editing={canEdit}
              onConfigure={() => setConfiguringId(placement.id)}
              onRemove={() => layoutApi.removeWidget(placement.id)}
            >
              <Widget
                summary={summary}
                config={placement.config}
                onClearScope={() =>
                  layoutApi.updateWidgetConfig(placement.id, {
                    ...placement.config,
                    projectId: undefined,
                    sprintId: undefined,
                    teamId: undefined,
                  })
                }
              />
            </WidgetShell>
          );
        })}
      </div>

      {configuring && (
        <WidgetConfigPanel
          key={configuring.id}
          placement={configuring}
          title={WIDGET_REGISTRY[configuring.type].title}
          ui={layout.ui}
          onSave={(config) => layoutApi.updateWidgetConfig(configuring.id, config)}
          onSaveUi={(patch) => layoutApi.updateUi(patch)}
          onClose={() => setConfiguringId(null)}
        />
      )}
    </section>
  );
}
