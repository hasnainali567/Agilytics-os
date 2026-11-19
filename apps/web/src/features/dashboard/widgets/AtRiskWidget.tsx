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
        <li key={m.id} className="rounded-inner bg-pill p-4">
          <p className="flex items-center gap-2 font-medium text-ink">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                m.status === "OVERLOADED" ? "bg-risk" : "bg-warn"
              }`}
              aria-hidden
            />
            {m.name}
            <span
              className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ${
                m.status === "OVERLOADED" ? "bg-risk/10 text-risk" : "bg-warn/10 text-warn"
              }`}
            >
              {m.status === "OVERLOADED" ? "Over capacity" : "At risk"}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted">
            {m.activeTickets} active tickets, {m.completedPoints} points done —{" "}
            {m.status === "OVERLOADED" ? "over capacity" : "falling behind"}
          </p>
        </li>
      ))}
    </ul>
  );
}
