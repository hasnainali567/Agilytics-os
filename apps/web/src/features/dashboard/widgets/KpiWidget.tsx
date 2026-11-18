import type { WidgetProps } from "../types";
import { EmptyScope, EmptyState, hasScope } from "./EmptyScope";

const STATS: Record<string, { label: string; deltaLabel: string }> = {
  velocity: { label: "Sprint velocity", deltaLabel: "vs last sprint" },
  done: { label: "Tickets done", deltaLabel: "vs last sprint" },
  overdue: { label: "Overdue tickets", deltaLabel: "open now" },
  "at-risk": { label: "Members at risk", deltaLabel: "need attention" },
  projects: { label: "Active projects", deltaLabel: "vs last sprint" },
};

/** One stat + trend. Trends always carry an explicit + / −, never colour alone. */
export function KpiWidget({ summary, config, onClearScope }: WidgetProps) {
  if (hasScope(config)) return <EmptyScope onClearScope={onClearScope} />;
  const stat = config.stat ?? "velocity";
  const meta = STATS[stat];
  if (!meta) {
    return (
      <EmptyState>{`Unknown stat “${stat}” — open the widget settings and pick a stat.`}</EmptyState>
    );
  }
  const { kpis } = summary;
  const value =
    stat === "velocity"
      ? kpis.velocityPoints
      : stat === "done"
        ? kpis.ticketsDoneThisSprint
        : stat === "overdue"
          ? kpis.overdueTickets
          : stat === "at-risk"
            ? kpis.atRiskMembers
            : kpis.activeProjects;
  const delta =
    stat === "velocity"
      ? kpis.velocityDelta
      : stat === "done"
        ? kpis.ticketsDoneDelta
        : stat === "overdue"
          ? -kpis.overdueTickets
          : stat === "projects"
            ? kpis.activeProjectsDelta
            : 0;
  const positive = delta >= 0;
  return (
    <div className="p-5">
      <p className="text-[13px] font-medium text-muted">{meta.label}</p>
      <p className="mt-2 text-4xl font-semibold tabular-nums text-ink">{value}</p>
      <p className={`mt-1 text-xs font-medium ${positive ? "text-done" : "text-risk"}`}>
        {positive ? `+${delta}` : `−${Math.abs(delta)}`} {meta.deltaLabel}
      </p>
    </div>
  );
}
