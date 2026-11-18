import { useState } from "react";
import type { UiPrefs, WidgetConfig, WidgetPlacement } from "./types";

/**
 * Widget config panel — a side sheet, not a modal, so the user sees
 * the widget change live (FRONTEND.md §1B). Edits apply on save;
 * scope ids are stored as typed and validated by the API on PUT.
 */
export function WidgetConfigPanel({
  placement,
  title,
  ui,
  onSave,
  onSaveUi,
  onClose,
}: {
  placement: WidgetPlacement;
  title: string;
  ui: UiPrefs;
  onSave: (config: WidgetConfig) => void;
  onSaveUi: (patch: Partial<UiPrefs>) => void;
  onClose: () => void;
}) {
  const [config, setConfig] = useState<WidgetConfig>(placement.config);
  const set = (patch: Partial<WidgetConfig>) => setConfig((c) => ({ ...c, ...patch }));
  const setScope = (key: "projectId" | "sprintId" | "teamId", value: string) =>
    set({ [key]: value.trim() === "" ? undefined : value.trim() } as Partial<WidgetConfig>);

  return (
    <aside
      aria-label={`Configure ${title}`}
      className="fixed inset-y-0 right-0 z-20 flex w-full max-w-sm flex-col overflow-y-auto border-l border-line bg-panel p-6 shadow-lg"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">Configure — {title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close settings"
          className="rounded-full bg-pill px-3 py-1 text-sm text-ink"
        >
          ✕
        </button>
      </div>

      {placement.type === "kpi" && (
        <label className="mt-6 block text-sm">
          <span className="font-medium text-ink">Stat shown</span>
          <select
            value={config.stat ?? "velocity"}
            onChange={(e) => set({ stat: e.target.value })}
            className="mt-1 w-full rounded-2xl border border-line bg-panel px-3 py-2"
          >
            <option value="velocity">Sprint velocity (points)</option>
            <option value="done">Tickets done</option>
            <option value="overdue">Overdue tickets</option>
            <option value="at-risk">Members at risk</option>
            <option value="projects">Active projects</option>
          </select>
        </label>
      )}

      {placement.type === "velocity" && (
        <label className="mt-6 block text-sm">
          <span className="font-medium text-ink">Time range</span>
          <select
            value={config.timeRange ?? "6w"}
            onChange={(e) => set({ timeRange: e.target.value as WidgetConfig["timeRange"] })}
            className="mt-1 w-full rounded-2xl border border-line bg-panel px-3 py-2"
          >
            <option value="4w">Last 4 weeks</option>
            <option value="6w">Last 6 weeks</option>
            <option value="12w">Last 12 weeks</option>
          </select>
        </label>
      )}

      <fieldset className="mt-6">
        <legend className="text-sm font-medium text-ink">Scope</legend>
        <p className="mt-1 text-xs text-muted">
          Scoped widgets show an empty state until the reporting API can break numbers down by
          project, sprint or team — they never show another scope&apos;s data.
        </p>
        {(["projectId", "sprintId", "teamId"] as const).map((key) => (
          <label key={key} className="mt-3 block text-sm">
            <span className="text-muted">
              {key === "projectId" ? "Project ID" : key === "sprintId" ? "Sprint ID" : "Team ID"}
            </span>
            <input
              value={config[key] ?? ""}
              onChange={(e) => setScope(key, e.target.value)}
              placeholder="UUID — leave blank for workspace-wide"
              className="mt-1 w-full rounded-2xl border border-line bg-panel px-3 py-2 font-mono text-xs"
            />
          </label>
        ))}
      </fieldset>

      <fieldset className="mt-6">
        <legend className="text-sm font-medium text-ink">Display</legend>
        <label className="mt-3 block text-sm">
          <span className="text-muted">Density</span>
          <select
            value={ui.density}
            onChange={(e) => onSaveUi({ density: e.target.value as UiPrefs["density"] })}
            className="mt-1 w-full rounded-2xl border border-line bg-panel px-3 py-2"
          >
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </label>
        <label className="mt-3 flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={ui.sidebarCollapsed}
            onChange={(e) => onSaveUi({ sidebarCollapsed: e.target.checked })}
          />
          Sidebar collapsed
        </label>
        <p className="mt-2 text-xs text-muted">
          Density and sidebar choices save with this layout and sync across devices. The theme
          itself stays Agibankz — colours are not configurable.
        </p>
      </fieldset>

      <div className="mt-8 flex gap-2">
        <button
          type="button"
          onClick={() => {
            onSave(config);
            onClose();
          }}
          className="rounded-full bg-forest px-5 py-2 text-sm font-medium text-white"
        >
          Save widget
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-line bg-panel px-5 py-2 text-sm font-medium text-ink"
        >
          Cancel
        </button>
      </div>
    </aside>
  );
}
