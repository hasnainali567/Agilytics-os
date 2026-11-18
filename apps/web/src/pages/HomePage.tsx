import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button, Card } from "../components/ui";
import { TopBar } from "../components/layout";
import { DashboardGrid } from "../features/dashboard/DashboardGrid";
import { fetchDashboardSummary } from "../lib/api";

/**
 * Executive Dashboard — Agibankz (decision 19).
 * Hero: white main-KPI card (57%) + lime highlight card (43%). NO dark
 * hero card. Below it, the customisable widget grid (decision 20):
 * the Manager template's first row is the Agibankz bottom 3 columns —
 * Workload donut / Velocity progress bars / Today feed.
 * Real data only, from GET /api/v1/reporting/dashboard-summary.
 */
export function HomePage() {
  const [showHeroNumber, setShowHeroNumber] = useState(true);
  const [editing, setEditing] = useState(false);
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
            <p className="font-semibold text-ink">The API isn&apos;t reachable.</p>
            <p className="text-muted">
              Start it with <code>docker compose up -d</code> then{" "}
              <code>pnpm --filter api start:dev</code> and seed it with{" "}
              <code>pnpm --filter api prisma:seed</code>. No mock data is shown.
            </p>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-12">
              {/* White card (57%) — the main KPI. */}
              <Card className="relative p-6 lg:col-span-7">
                <div className="flex items-start justify-between">
                  <p className="text-[13px] font-medium text-muted">Sprint velocity</p>
                  <button
                    type="button"
                    onClick={() => setShowHeroNumber((v) => !v)}
                    aria-label={showHeroNumber ? "Hide velocity number" : "Show velocity number"}
                    className="rounded-full bg-pill px-3 py-1 text-xs font-medium text-ink"
                  >
                    {showHeroNumber ? "Hide" : "Show"}
                  </button>
                </div>
                <p className="hero-number mt-2 text-ink">
                  {showHeroNumber ? `${data.kpis.velocityPoints} pts` : "•••"}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {data.kpis.ticketsDoneThisSprint} tickets done, {data.kpis.overdueTickets}{" "}
                  overdue, {data.kpis.atRiskMembers} members at risk.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button asChild>
                    <Link to="/reports">View reports</Link>
                  </Button>
                  <Button variant="secondary" asChild>
                    <Link to="/sprints">View sprints</Link>
                  </Button>
                </div>
                <Link
                  to="/reports"
                  aria-label="Go to reports"
                  className="absolute bottom-6 right-6 flex h-12 w-12 items-center justify-center rounded-full bg-lime text-xl font-semibold text-forest"
                >
                  →
                </Link>
              </Card>

              {/* Lime card (43%) — the highlight. */}
              <div className="rounded-card bg-lime p-6 lg:col-span-5">
                <span className="inline-flex rounded-full bg-forest px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
                  Priority · this sprint
                </span>
                <p className="hero-number mt-3 text-forest">{data.kpis.ticketsDoneThisSprint}</p>
                <p className="text-sm font-medium text-forest">tickets done</p>
                <span className="mt-2 inline-flex rounded-full bg-panel px-3 py-1 text-xs font-medium text-ink">
                  {data.kpis.ticketsDoneDelta >= 0 ? "+" : "−"}
                  {Math.abs(data.kpis.ticketsDoneDelta)} vs last sprint
                </span>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-lime-light p-4">
                    <p className="text-2xl font-semibold tabular-nums text-forest">
                      {data.today.updatedMembers}/{data.today.totalMembers}
                    </p>
                    <p className="text-xs font-medium text-forest">updated today</p>
                  </div>
                  <div className="rounded-2xl bg-lime-light p-4">
                    <p className="text-2xl font-semibold tabular-nums text-forest">
                      {data.today.openBlockers}
                    </p>
                    <p className="text-xs font-medium text-forest">open blockers</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <h2 className="text-lg font-semibold text-ink">My dashboard</h2>
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                aria-pressed={editing}
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  editing ? "bg-forest text-white" : "border border-line bg-panel text-ink"
                }`}
              >
                {editing ? "Done customising" : "Customise"}
              </button>
            </div>
            <DashboardGrid summary={data} editing={editing} />
          </>
        )}
      </main>
    </div>
  );
}
