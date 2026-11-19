import type { WidgetProps } from "../types";
import { EmptyScope, EmptyState, hasScope } from "./EmptyScope";

const STATS: Record<string, { label: string; deltaLabel: string }> = {
  velocity: { label: "Sprint velocity", deltaLabel: "vs last sprint" },
  done: { label: "Tickets done", deltaLabel: "vs last sprint" },
  overdue: { label: "Overdue tickets", deltaLabel: "open now" },
  "at-risk": { label: "Members at risk", deltaLabel: "need attention" },
  projects: { label: "Active projects", deltaLabel: "vs last sprint" },
};

/**
 * One stat + trend. Trends always carry an explicit + / −, never colour
 * alone. No fixed height: the card sizes to its content (the grid rows
 * grow to fit — see DashboardGrid), so the number is never clipped.
 */
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
    <div className="flex flex-col justify-center px-5 py-4">
      <p className="text-[13px] font-medium text-muted">{meta.label}</p>
      <p className="widget-number mt-1.5 text-ink">{value}</p>
      <span
        className={`mt-2 inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums ${
          positive ? "bg-lime text-forest" : "bg-risk/10 text-risk"
        }`}
      >
        {positive ? `+${delta}` : `−${Math.abs(delta)}`} {meta.deltaLabel}
      </span>
    </div>
  );
}
