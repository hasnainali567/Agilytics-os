import type { WidgetProps } from "../types";
import { EmptyScope, EmptyState, hasScope } from "./EmptyScope";

const STATS: Record<string, { label: string; deltaLabel: string; icon: string; tile: string }> = {
  velocity: {
    label: "Sprint velocity",
    deltaLabel: "vs last sprint",
    icon: "↗",
    tile: "bg-[#EFEAFE] text-[#6C5CE7]",
  },
  done: {
    label: "Tickets done",
    deltaLabel: "vs last sprint",
    icon: "✓",
    tile: "bg-done-light text-done-strong",
  },
  overdue: {
    label: "Overdue tickets",
    deltaLabel: "open now",
    icon: "!",
    tile: "bg-risk-light text-risk",
  },
  "at-risk": {
    label: "Members at risk",
    deltaLabel: "need attention",
    icon: "!",
    tile: "bg-warn-light text-amber-600",
  },
  projects: {
    label: "Active projects",
    deltaLabel: "vs last sprint",
    icon: "▦",
    tile: "bg-[#EFEAFE] text-[#6C5CE7]",
  },
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
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-sm font-bold ${meta.tile}`}
        >
          {meta.icon}
        </span>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{meta.label}</p>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-ink">{value}</p>
      <span
        className={`mt-2 inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums ${
          positive ? "bg-done-light text-done-strong" : "bg-risk-light text-risk"
        }`}
      >
        {positive ? `+${delta}` : `−${Math.abs(delta)}`} {meta.deltaLabel}
      </span>
    </div>
  );
}
