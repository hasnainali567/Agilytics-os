import type { DashboardKpis } from "@agilytics/shared";
import { Card } from "../components/ui";

function KpiCard({ label, value, delta }: { label: string; value: number; delta: number }) {
  const positive = delta >= 0;
  return (
    <Card className="p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-label">{label}</p>
      <p className="widget-number mt-2 text-ink">{value}</p>
      <span
        className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums ${
          positive ? "bg-lime text-forest" : "bg-risk/10 text-risk"
        }`}
      >
        {positive ? `+${delta}` : `−${Math.abs(delta)}`} vs last sprint
      </span>
    </Card>
  );
}

export function KpiRow({ kpis }: { kpis: DashboardKpis }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <KpiCard
        label="Active projects"
        value={kpis.activeProjects}
        delta={kpis.activeProjectsDelta}
      />
      <KpiCard
        label="Tickets done"
        value={kpis.ticketsDoneThisSprint}
        delta={kpis.ticketsDoneDelta}
      />
      <KpiCard label="Velocity (pts)" value={kpis.velocityPoints} delta={kpis.velocityDelta} />
      <KpiCard label="Overdue tickets" value={kpis.overdueTickets} delta={-kpis.overdueTickets} />
    </div>
  );
}
