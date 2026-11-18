import type { WidgetProps } from "../types";
import { EmptyScope, hasScope } from "./EmptyScope";

/**
 * My Work — assigned to me, due today / overdue, blocked, mentioned.
 * The dashboard summary is workspace-wide and the API does not expose
 * the caller's identity to the web yet (GET /identity/me returns all
 * memberships, not the caller), so per-person filtering is not
 * possible here. Until that lands, this widget shows the workspace's
 * work that needs attention, labelled as such — never as "yours".
 */
export function MyWorkWidget({ summary, config, onClearScope }: WidgetProps) {
  if (hasScope(config)) return <EmptyScope onClearScope={onClearScope} />;
  const { kpis, today } = summary;
  return (
    <div className="space-y-3 p-5 text-sm">
      <p className="text-muted">
        Per-person filtering needs the signed-in user&apos;s identity, which the API doesn&apos;t
        expose yet — showing workspace work that needs attention instead.
      </p>
      <ul className="space-y-2">
        <li className="flex justify-between rounded-xl bg-pill px-3 py-2">
          <span className="font-medium text-ink">Overdue tickets</span>
          <span className="tabular-nums text-risk">{kpis.overdueTickets}</span>
        </li>
        <li className="flex justify-between rounded-xl bg-pill px-3 py-2">
          <span className="font-medium text-ink">Open blockers today</span>
          <span className="tabular-nums text-risk">{today.openBlockers}</span>
        </li>
        <li className="flex justify-between rounded-xl bg-pill px-3 py-2">
          <span className="font-medium text-ink">Stale tickets (3+ days)</span>
          <span className="tabular-nums text-ink">{today.staleTickets.length}</span>
        </li>
      </ul>
      {today.staleTickets.length > 0 && (
        <ul className="list-disc pl-5 text-muted">
          {today.staleTickets.slice(0, 5).map((t) => (
            <li key={t.id}>
              {t.title} — {t.daysStale} days
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
