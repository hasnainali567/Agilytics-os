import type { DashboardKpis } from "@agilytics/shared";
import { Card } from "../components/ui";

/**
 * KPI row — four stat cards in one row, Kanban main design:
 * white 18px cards, tinted icon tiles, bold 24px numbers, and a small
 * delta pill that always carries an explicit + / − sign.
 * Purple tile is the new primary #6C5CE7 on #EFEAFE (index.css still
 * carries the old accent tokens, so the new purple is literal here).
 */
function KpiCard({
  label,
  value,
  delta,
  icon,
  tile,
}: {
  label: string;
  value: number;
  delta: number;
  icon: string;
  tile: string;
}) {
  const positive = delta >= 0;
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-sm font-bold ${tile}`}
        >
          {icon}
        </span>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-ink">{value}</p>
      <span
        className={`mt-2 inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums ${
          positive ? "bg-done-light text-done-strong" : "bg-risk-light text-risk"
        }`}
      >
        {positive ? `+${delta}` : `−${Math.abs(delta)}`} vs last sprint
      </span>
    </Card>
  );
}

export function KpiRow({ kpis }: { kpis: DashboardKpis }) {
  return (
    <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
      <KpiCard
        label="Active projects"
        value={kpis.activeProjects}
        delta={kpis.activeProjectsDelta}
        icon="▦"
        tile="bg-[#EFEAFE] text-[#6C5CE7]"
      />
      <KpiCard
        label="Tickets done"
        value={kpis.ticketsDoneThisSprint}
        delta={kpis.ticketsDoneDelta}
        icon="✓"
        tile="bg-done-light text-done-strong"
      />
      <KpiCard
        label="Velocity (pts)"
        value={kpis.velocityPoints}
        delta={kpis.velocityDelta}
        icon="↗"
        tile="bg-[#EFEAFE] text-[#6C5CE7]"
      />
      <KpiCard
        label="Overdue tickets"
        value={kpis.overdueTickets}
        delta={-kpis.overdueTickets}
        icon="!"
        tile="bg-risk-light text-risk"
      />
    </div>
  );
}
