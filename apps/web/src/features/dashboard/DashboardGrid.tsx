import { DndContext, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import type { DashboardSummary } from "@agilytics/shared";
import { useState, type ReactNode } from "react";
import { WIDGET_REGISTRY } from "./registry";
import { defaultLayoutFor } from "./templates";
import { useDashboardLayout } from "./useDashboardLayout";
import { WidgetConfigPanel } from "./WidgetConfigPanel";
import { WidgetShell } from "./WidgetShell";
import type { RoleTemplate, WidgetType } from "./types";

function DroppableCell({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className="contents">
      {children}
    </div>
  );
}

/**
 * The customisable dashboard grid (FRONTEND.md §1B): 12 columns,
 * drag a widget onto another to swap places (dnd-kit core), arrow
 * buttons as the keyboard alternative, +W/−W and +H/−H resize in grid
 * units, Settings opens the config side sheet. Changes auto-save
 * (debounced) through useDashboardLayout.
 *
 * If the saved layout cannot load (e.g. the layout module is not
 * wired into AppModule yet), the grid falls back to the Manager
 * template read-only — the dashboard still renders, customisation
 * just waits for the API.
 */
export function DashboardGrid({
  summary,
  editing,
}: {
  summary: DashboardSummary;
  editing: boolean;
}) {
  const layoutApi = useDashboardLayout();
  const [configuringId, setConfiguringId] = useState<string | null>(null);
  const [addType, setAddType] = useState<WidgetType>("kpi");

  // Server layout when available, Manager template fallback on error.
  const layout = layoutApi.layout ?? (layoutApi.isError ? defaultLayoutFor("manager") : null);
  const readOnly = layoutApi.isError;
  const canEdit = editing && !readOnly;

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      layoutApi.swapWidgets(String(active.id), String(over.id));
    }
  }

  if (layoutApi.isPending || !layout) {
    return (
      <p className="rounded-card border border-line bg-panel p-6 text-sm text-muted">
        Loading your dashboard…
      </p>
    );
  }

  const configuring = layout.widgets.find((w) => w.id === configuringId) ?? null;
  // Rows size to content: a 1-row KPI widget (shell header + number +
  // trend pill) needs ~180px, far more than a fixed 128px row, so a
  // fixed gridAutoRows clipped it (overflow-hidden in WidgetShell).
  // minmax keeps the row minimum for resize math but lets rows grow
  // to fit their content — cards never clip.
  const rowMin = layout.ui.density === "compact" ? "104px" : "128px";

  return (
    <section aria-label="My dashboard">
      {readOnly && (
        <p className="mb-4 rounded-card border border-line bg-panel p-4 text-sm text-muted">
          Your saved layout couldn&apos;t load — showing the default Manager layout until the API is
          reachable. Customising is paused, not lost.
        </p>
      )}
      {canEdit && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <select
            value={addType}
            onChange={(e) => setAddType(e.target.value as WidgetType)}
            aria-label="Widget type to add"
            className="rounded-full border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-forest"
          >
            {Object.entries(WIDGET_REGISTRY).map(([type, def]) => (
              <option key={type} value={type}>
                {def.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => layoutApi.addWidget(addType)}
            className="rounded-full bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest/90"
          >
            + Add widget
          </button>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) layoutApi.applyTemplate(e.target.value as RoleTemplate);
            }}
            aria-label="Apply a role template"
            className="rounded-full border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-forest"
          >
            <option value="">Apply template…</option>
            <option value="manager">Manager</option>
            <option value="lead">Lead</option>
            <option value="developer">Developer</option>
            <option value="viewer">Viewer</option>
          </select>
          <button
            type="button"
            onClick={() => layoutApi.reset()}
            disabled={layoutApi.isResetting}
            className="rounded-full border border-line bg-panel px-4 py-2 text-sm font-medium text-ink"
          >
            Reset to default
          </button>
          {layoutApi.isSaving && <span className="text-xs text-muted">Saving…</span>}
        </div>
      )}

      <DndContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-12 gap-4" style={{ gridAutoRows: `minmax(${rowMin}, auto)` }}>
          {layout.widgets.map((placement) => {
            const def = WIDGET_REGISTRY[placement.type];
            const Widget = def.component;
            return (
              <DroppableCell key={placement.id} id={placement.id}>
                <WidgetShell
                  placement={placement}
                  title={def.title}
                  editing={canEdit}
                  onConfigure={() => setConfiguringId(placement.id)}
                  onRemove={() => layoutApi.removeWidget(placement.id)}
                  onResize={(dw, dh) => layoutApi.resizeWidget(placement.id, dw, dh)}
                  onMove={(dir) => layoutApi.moveWidget(placement.id, dir)}
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
              </DroppableCell>
            );
          })}
        </div>
      </DndContext>

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
