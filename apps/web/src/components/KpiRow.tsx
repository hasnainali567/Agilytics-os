import type { DashboardKpis } from "@agilytics/shared";
import { Card } from "../components/ui";

function KpiCard({ label, value, delta }: { label: string; value: number; delta: number }) {
  const positive = delta >= 0;
  return (
    <Card className="p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-3xl font-bold text-ink">{value}</p>
      <p className={`mt-1 text-xs font-medium ${positive ? "text-done" : "text-risk"}`}>
        {positive ? "▲" : "▼"} {Math.abs(delta)} vs last sprint
      </p>
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
