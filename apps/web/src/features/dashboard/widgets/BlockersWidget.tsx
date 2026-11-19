import type { WidgetProps } from "../types";
import { EmptyScope, EmptyState, hasScope } from "./EmptyScope";

/**
 * Open blockers, by project or sprint (config scope). The summary
 * carries the blocker COUNT from today's daily updates plus the stale
 * tickets that need attention; per-ticket blocker text is not in the
 * summary yet, so this widget never invents it.
 */
export function BlockersWidget({ summary, config, onClearScope }: WidgetProps) {
  if (hasScope(config)) return <EmptyScope onClearScope={onClearScope} />;
  const { today } = summary;
  if (today.openBlockers === 0 && today.staleTickets.length === 0) {
    return <EmptyState>No open blockers — nothing is stuck right now.</EmptyState>;
  }
  return (
    <div className="space-y-3 p-5 text-sm">
      {today.openBlockers > 0 && (
        <p className="flex items-center gap-2">
          <span className="inline-flex rounded-full bg-forest px-2.5 py-0.5 text-xs font-medium text-white">
            {today.openBlockers} open blocker{today.openBlockers === 1 ? "" : "s"}
          </span>
          <span className="text-muted">reported in today&apos;s daily updates.</span>
        </p>
      )}
      {today.staleTickets.length > 0 && (
        <div>
          <p className="font-medium text-ink">Stale — no update in 3+ days:</p>
          <ul className="mt-2 space-y-1.5">
            {today.staleTickets.map((t) => (
              <li key={t.id} className="rounded-inner bg-pill px-3 py-2 text-muted">
                {t.title} —{" "}
                <span className="tabular-nums text-warn">{t.daysStale} days stale</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
