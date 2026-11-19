import type { WidgetProps } from "../types";
import { EmptyScope, hasScope } from "./EmptyScope";

/** Today feed — who updated, who is silent, open blockers, stale tickets. */
export function TodayFeedWidget({ summary, config, onClearScope }: WidgetProps) {
  if (hasScope(config)) return <EmptyScope onClearScope={onClearScope} />;
  const { today } = summary;
  const isEmpty =
    today.updatedNames.length === 0 &&
    today.silentNames.length === 0 &&
    today.openBlockers === 0 &&
    today.staleTickets.length === 0;
  return (
    <div className="space-y-3 p-5 text-sm">
      <p className="font-medium text-ink">
        <span className="tabular-nums text-forest">{today.updatedMembers}</span> of{" "}
        <span className="tabular-nums">{today.totalMembers}</span> updated today
      </p>
      {today.updatedNames.length > 0 && (
        <p className="flex items-start gap-2 rounded-inner bg-pill px-3 py-2">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-done" aria-hidden />
          <span>
            <span className="font-medium text-done">Updated: </span>
            <span className="text-muted">{today.updatedNames.join(", ")}</span>
          </span>
        </p>
      )}
      {today.silentNames.length > 0 && (
        <p className="flex items-start gap-2 rounded-inner bg-pill px-3 py-2">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-warn" aria-hidden />
          <span>
            <span className="font-medium text-warn">Silent today: </span>
            <span className="text-muted">{today.silentNames.join(", ")}</span>
          </span>
        </p>
      )}
      {today.openBlockers > 0 && (
        <p className="flex items-start gap-2 rounded-inner bg-pill px-3 py-2">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-risk" aria-hidden />
          <span>
            <span className="font-medium text-risk">Open blockers: </span>
            <span className="tabular-nums text-muted">{today.openBlockers}</span>
          </span>
        </p>
      )}
      {today.staleTickets.length > 0 && (
        <div>
          <p className="font-medium text-ink">Stale tickets (no update in 3+ days):</p>
          <ul className="mt-2 space-y-1.5">
            {today.staleTickets.map((t) => (
              <li key={t.id} className="rounded-inner bg-pill px-3 py-2 text-muted">
                {t.title} — <span className="tabular-nums text-warn">{t.daysStale} days</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {isEmpty && <p className="text-muted">No daily updates yet today.</p>}
    </div>
  );
}
