import { useQuery } from "@tanstack/react-query";
import { KpiRow } from "../components/KpiRow";
import { MembersTable } from "../components/MembersTable";
import { TopBar } from "../components/layout";
import { VelocityChart } from "../components/VelocityChart";
import { Card, CardHeader } from "../components/ui";
import { fetchDashboardSummary } from "../lib/api";

/** Home dashboard — Pin 1 shell, Pin 3 reporting layout, Pin 4 hero card.
 *  Real data only, from GET /api/v1/reporting/dashboard-summary. */
export function HomePage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: fetchDashboardSummary,
    retry: false,
    // Phase 1 realtime: polling (see docs/REALTIME.md). No WebSocket yet.
    refetchInterval: 30_000,
  });

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar title="Good morning — here's your team at a glance" />
      <main className="space-y-4 p-6">
        {isPending ? (
          <Card className="p-6 text-sm text-muted">Loading your dashboard…</Card>
        ) : isError || !data ? (
          <Card className="p-6 text-sm">
            <p className="font-semibold text-ink">The API isn't reachable.</p>
            <p className="text-muted">
              Start it with <code>docker compose up -d</code> then{" "}
              <code>pnpm --filter api start:dev</code> and seed it with{" "}
              <code>pnpm --filter api prisma:seed</code>. No mock data is shown.
            </p>
          </Card>
        ) : (
          <>
            <Card className="bg-navy-900 p-6 text-white">
              <p className="text-xs uppercase tracking-wide text-slate-400">Sprint health</p>
              <p className="mt-2 text-4xl font-bold">On track · {data.kpis.velocityPoints} pts</p>
              <p className="mt-1 text-sm text-slate-300">
                {data.kpis.ticketsDoneThisSprint} tickets done, {data.kpis.overdueTickets} overdue,{" "}
                {data.kpis.atRiskMembers} members at risk.
              </p>
            </Card>
            <KpiRow kpis={data.kpis} />
            <VelocityChart data={data.velocity} />
            <Card>
              <CardHeader
                title={`Today — ${data.today.updatedMembers} of ${data.today.totalMembers} updated`}
                subtitle="Daily updates, not comments — who posted, who is silent, open blockers"
              />
              <div className="space-y-3 p-5 text-sm">
                {data.today.updatedNames.length > 0 && (
                  <p>
                    <span className="font-medium text-green-700">Updated: </span>
                    {data.today.updatedNames.join(", ")}
                  </p>
                )}
                {data.today.silentNames.length > 0 && (
                  <p>
                    <span className="font-medium text-amber-700">Silent today: </span>
                    {data.today.silentNames.join(", ")}
                  </p>
                )}
                {data.today.openBlockers > 0 && (
                  <p>
                    <span className="font-medium text-red-700">Open blockers: </span>
                    {data.today.openBlockers}
                  </p>
                )}
                {data.today.staleTickets.length > 0 && (
                  <div>
                    <p className="font-medium">Stale tickets (no update in 3+ days):</p>
                    <ul className="mt-1 list-disc pl-5 text-muted">
                      {data.today.staleTickets.map((t) => (
                        <li key={t.id}>
                          {t.title} — {t.daysStale} days
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {data.today.updatedNames.length === 0 &&
                  data.today.silentNames.length === 0 &&
                  data.today.openBlockers === 0 &&
                  data.today.staleTickets.length === 0 && (
                    <p className="text-muted">No daily updates yet today.</p>
                  )}
              </div>
            </Card>
            <MembersTable members={data.members} />
          </>
        )}
        <Card>
          <CardHeader
            title="Connections — coming next"
            subtitle="Slack, Notion, Google Calendar, GitHub"
          />
          <p className="p-5 text-sm text-muted">
            The Connections hub and automation builder (trigger → action) are the next slice after
            this dashboard. See the root README.
          </p>
        </Card>
      </main>
    </div>
  );
}
