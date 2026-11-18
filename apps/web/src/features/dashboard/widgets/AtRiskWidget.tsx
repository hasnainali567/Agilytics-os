import type { WidgetProps } from "../types";
import { EmptyScope, EmptyState, hasScope } from "./EmptyScope";

/** At-risk tickets / members, from Daily Updates + stale detection. */
export function AtRiskWidget({ summary, config, onClearScope }: WidgetProps) {
  if (hasScope(config)) return <EmptyScope onClearScope={onClearScope} />;
  const atRisk = summary.members.filter((m) => m.status === "AT_RISK" || m.status === "OVERLOADED");
  if (atRisk.length === 0) {
    return <EmptyState>No members at risk right now.</EmptyState>;
  }
  return (
    <ul className="space-y-3 p-5 text-sm">
      {atRisk.map((m) => (
        <li key={m.id} className="rounded-2xl border border-line bg-panel p-3">
          <p className="font-medium text-ink">{m.name}</p>
          <p className="text-xs text-muted">
            {m.activeTickets} active tickets, {m.completedPoints} points done —{" "}
            {m.status === "OVERLOADED" ? "over capacity" : "falling behind"}
          </p>
        </li>
      ))}
    </ul>
  );
}
