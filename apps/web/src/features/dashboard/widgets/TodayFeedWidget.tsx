import type { WidgetProps } from "../types";
import { EmptyScope, hasScope } from "./EmptyScope";

/** Today feed — who updated, who is silent, open blockers, stale tickets. */
export function TodayFeedWidget({ summary, config, onClearScope }: WidgetProps) {
  if (hasScope(config)) return <EmptyScope onClearScope={onClearScope} />;
  const { today } = summary;
  return (
    <div className="space-y-3 p-5 text-sm">
      <p className="font-medium text-ink">
        {today.updatedMembers} of {today.totalMembers} updated today
      </p>
      {today.updatedNames.length > 0 && (
        <p>
          <span className="font-medium text-done">Updated: </span>
          <span className="text-muted">{today.updatedNames.join(", ")}</span>
        </p>
      )}
      {today.silentNames.length > 0 && (
        <p>
          <span className="font-medium text-warn">Silent today: </span>
          <span className="text-muted">{today.silentNames.join(", ")}</span>
        </p>
      )}
      {today.openBlockers > 0 && (
        <p>
          <span className="font-medium text-risk">Open blockers: </span>
          <span className="text-muted">{today.openBlockers}</span>
        </p>
      )}
      {today.staleTickets.length > 0 && (
        <div>
          <p className="font-medium text-ink">Stale tickets (no update in 3+ days):</p>
          <ul className="mt-1 list-disc pl-5 text-muted">
            {today.staleTickets.map((t) => (
              <li key={t.id}>
                {t.title} — {t.daysStale} days
              </li>
            ))}
          </ul>
        </div>
      )}
      {today.updatedNames.length === 0 &&
        today.silentNames.length === 0 &&
        today.openBlockers === 0 &&
        today.staleTickets.length === 0 && (
          <p className="text-muted">No daily updates yet today.</p>
        )}
    </div>
  );
}
