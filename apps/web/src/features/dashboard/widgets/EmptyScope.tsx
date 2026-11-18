import type { WidgetConfig } from "../types";

/**
 * A widget is "scoped" when its config names a project, sprint or
 * team. The reporting API only returns tenant-wide aggregates so far,
 * so a scoped widget must NOT render tenant data as if it were scoped
 * data — it renders this empty state with a "re-pick scope" action
 * (FRONTEND.md §1B).
 */
export function hasScope(config: WidgetConfig): boolean {
  return Boolean(config.projectId ?? config.sprintId ?? config.teamId);
}

export function EmptyScope({ onClearScope }: { onClearScope: () => void }) {
  return (
    <div className="flex h-full flex-col items-start justify-center gap-2 p-5 text-sm">
      <p className="font-semibold text-ink">No data for this scope yet</p>
      <p className="text-muted">
        This widget is scoped to a project, sprint or team, but the reporting API only returns
        workspace-wide numbers so far.
      </p>
      <button
        type="button"
        onClick={onClearScope}
        className="rounded-full bg-forest px-4 py-2 text-sm font-medium text-white"
      >
        Clear scope — show workspace data
      </button>
    </div>
  );
}

export function EmptyState({ children }: { children: string }) {
  return <p className="p-5 text-sm text-muted">{children}</p>;
}
