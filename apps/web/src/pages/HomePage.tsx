import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "../components/ui";
import { TopBar } from "../components/layout";
import { DashboardGrid } from "../features/dashboard/DashboardGrid";
import { fetchDashboardSummary } from "../lib/api";
import { useRealtime } from "../lib/useRealtime";

/**
 * Executive Dashboard — Kanban main design (locked 2026-11-19):
 * light blue-grey page #E9EEF5, white 18px cards, vivid purple
 * primary #6C5CE7 on #EFEAFE. (index.css still carries the old accent
 * tokens, so the new purple is literal here.)
 *
 * "Welcome back" header row (date pill, purple "+ New" button,
 * Customise toggle) → 4 KPI cards in one row (velocity / tickets
 * done / members at risk / open blockers, each with a tinted icon
 * tile and a small delta) → the fixed widget grid (DashboardGrid),
 * whose layout is fixed and only its visibility is customisable.
 * Real data only, from GET /api/v1/reporting/dashboard-summary.
 */
function KpiCard({
  label,
  value,
  delta,
  icon,
  tile,
  pill,
}: {
  label: string;
  value: number | string;
  delta: string;
  icon: string;
  tile: string;
  pill: string;
}) {
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
      <span className={`mt-2 inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums ${pill}`}>
        {delta}
      </span>
    </Card>
  );
}

export function HomePage() {
  // Phase 2 realtime: live invalidation on ticket/daily-update events;
  // the 30s polling below stays as the fallback when the socket is down.
  useRealtime();
  const [showHeroNumber, setShowHeroNumber] = useState(true);
  const [editing, setEditing] = useState(false);
  const { data, isPending, isError } = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: fetchDashboardSummary,
    retry: false,
    // Phase 1 realtime: polling (see docs/REALTIME.md). No WebSocket yet.
    refetchInterval: 30_000,
  });
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="flex min-h-full flex-col bg-[#E9EEF5]">
      <TopBar title="Good morning — here's your team at a glance" />
      <main className="space-y-5 px-6 py-6 lg:px-8">
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
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-ink">Welcome back</h1>
                <p className="mt-1 text-sm text-muted">
                  Here&apos;s your team at a glance — {data.kpis.ticketsDoneThisSprint} tickets
                  done, {data.kpis.overdueTickets} overdue, {data.kpis.atRiskMembers} members at
                  risk.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-muted">
                  {today}
                </span>
                <Link
                  to="/boards"
                  className="inline-flex items-center justify-center rounded-[10px] bg-[#6C5CE7] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#5B4BD6]"
                >
                  + New
                </Link>
                <button
                  type="button"
                  onClick={() => setEditing((v) => !v)}
                  aria-pressed={editing}
                  className={`rounded-[10px] px-4 py-2 text-sm font-medium transition-colors ${
                    editing
                      ? "bg-[#6C5CE7] text-white hover:bg-[#5B4BD6]"
                      : "border border-line bg-white text-ink hover:bg-pill"
                  }`}
                >
                  {editing ? "Done customising" : "Customise"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
              <KpiCard
                label="Sprint velocity"
                value={showHeroNumber ? `${data.kpis.velocityPoints} pts` : "•••"}
                delta={`${data.kpis.velocityDelta >= 0 ? "+" : "−"}${Math.abs(data.kpis.velocityDelta)} vs last sprint`}
                icon="↗"
                tile="bg-[#EFEAFE] text-[#6C5CE7]"
                pill="bg-done-light text-done-strong"
              />
              <KpiCard
                label="Tickets done"
                value={data.kpis.ticketsDoneThisSprint}
                delta={`${data.kpis.ticketsDoneDelta >= 0 ? "+" : "−"}${Math.abs(data.kpis.ticketsDoneDelta)} vs last sprint`}
                icon="✓"
                tile="bg-done-light text-done-strong"
                pill="bg-done-light text-done-strong"
              />
              <KpiCard
                label="Members at risk"
                value={data.kpis.atRiskMembers}
                delta="need attention"
                icon="!"
                tile="bg-warn-light text-amber-600"
                pill="bg-warn-light text-amber-600"
              />
              <KpiCard
                label="Open blockers"
                value={data.today.openBlockers}
                delta={`${data.today.updatedMembers}/${data.today.totalMembers} updated today`}
                icon="⧉"
                tile="bg-risk-light text-risk"
                pill="bg-risk-light text-risk"
              />
            </div>

            <div className="flex items-center justify-between pt-3">
              <h2 className="text-base font-semibold text-ink">My dashboard</h2>
              <button
                type="button"
                onClick={() => setShowHeroNumber((v) => !v)}
                aria-label={showHeroNumber ? "Hide velocity number" : "Show velocity number"}
                className="rounded-full bg-pill px-3 py-1 text-xs font-medium text-ink hover:bg-line"
              >
                {showHeroNumber ? "Hide velocity" : "Show velocity"}
              </button>
            </div>
            <DashboardGrid summary={data} editing={editing} />
          </>
        )}
      </main>
    </div>
  );
}
