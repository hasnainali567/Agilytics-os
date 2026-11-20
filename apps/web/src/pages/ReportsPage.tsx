import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { Calendar, CheckCircle2, Clock, Users, Zap } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { TopBar } from "../components/layout";
import { MembersTable } from "../components/MembersTable";
import { VelocityChart } from "../components/VelocityChart";
import {
  fetchDashboardSummary,
  fetchProjects,
  fetchSprints,
  fetchTickets,
  fetchTimeReport,
  type TicketWithStatus,
} from "../lib/api";

/* Pin 3 DealDeck tokens (literal hex — the Reports page keeps its own
 * lavender-grey / royal-blue palette, distinct from the Pin 1 shell):
 * page bg #E9EBF3, cards #FFFFFF, royal blue #3B5BFF, ink #111827,
 * muted #6B7280 / #94A3B8, borders #E5E7EB, green #22C55E on #DCFCE7,
 * red #EF4444 on #FEE2E2, grey chart series #CBD5E1. No banking-theme
 * colours, no sales/HR content — every section is PM content. */

function formatHours(minutes: number): string {
  return `${(minutes / 60).toFixed(1)}h`;
}

/** White Pin 3 card: 20px radius, 1px #E5E7EB border, very soft shadow. */
function ReportCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-[20px] border border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(17,24,39,0.05)] ${className}`}
    >
      {children}
    </section>
  );
}

/** Section title 15–17px bold + 11–12px grey subtitle, per Pin 3. */
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="border-b border-[#E5E7EB] px-5 py-4">
      <h2 className="text-[16px] font-bold text-[#111827]">{title}</h2>
      {subtitle ? <p className="mt-0.5 text-xs text-[#6B7280]">{subtitle}</p> : null}
    </div>
  );
}

function formatDelta(delta: number): string {
  return delta >= 0 ? `+${delta} vs last sprint` : `−${Math.abs(delta)} vs last sprint`;
}

type DeltaTone = "green" | "red" | "grey" | "on-blue";

const DELTA_PILL: Record<DeltaTone, string> = {
  green: "bg-[#DCFCE7] text-[#22C55E]",
  red: "bg-[#FEE2E2] text-[#EF4444]",
  grey: "bg-[#E9EBF3] text-[#6B7280]",
  "on-blue": "bg-white/20 text-white",
};

/** One KPI card: tinted icon square top-left, delta pill top-right.
 *  `filled` is the single royal-blue card of the 2x2 block. */
function KpiCard({
  label,
  value,
  suffix,
  subtitle,
  deltaText,
  deltaTone,
  icon: Icon,
  filled = false,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  subtitle: string;
  deltaText: string;
  deltaTone: DeltaTone;
  icon: LucideIcon;
  filled?: boolean;
}) {
  return (
    <div
      className={
        filled
          ? "rounded-[12px] bg-[#3B5BFF] p-5 shadow-[0_1px_2px_rgba(17,24,39,0.08)]"
          : "rounded-[12px] border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_2px_rgba(17,24,39,0.05)]"
      }
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] ${
            filled ? "bg-white/15 text-white" : "bg-[#EEF2FF] text-[#3B5BFF]"
          }`}
        >
          <Icon size={20} strokeWidth={2} />
        </span>
        <span
          className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums ${DELTA_PILL[deltaTone]}`}
        >
          {deltaText}
        </span>
      </div>
      <p
        className={`mt-4 text-[22px] font-bold leading-7 tabular-nums ${filled ? "text-white" : "text-[#111827]"}`}
      >
        {value}
        {suffix ? (
          <span
            className={`ml-1 text-base font-semibold ${filled ? "text-white/70" : "text-[#6B7280]"}`}
          >
            {suffix}
          </span>
        ) : null}
      </p>
      <p
        className={`mt-1 text-xs font-semibold uppercase tracking-wide ${
          filled ? "text-white/80" : "text-[#111827]"
        }`}
      >
        {label}
      </p>
      <p className={`mt-0.5 text-xs ${filled ? "text-white/70" : "text-[#6B7280]"}`}>{subtitle}</p>
    </div>
  );
}

const STATUS_SEGMENTS = [
  { key: "TODO", label: "To do", color: "#CBD5E1" },
  { key: "IN_PROGRESS", label: "In progress", color: "#3B5BFF" },
  { key: "DONE", label: "Done", color: "#22C55E" },
] as const;

/** Multi-ring donut — tickets by status category. One concentric ring
 *  per category (outer to inner: To do, In progress, Done), centre
 *  total, legend with counts and shares. Built here in ReportsPage;
 *  the dashboard WorkloadWidget donut is untouched. */
function TicketsByStatusDonut({
  tickets,
  isPending,
  isError,
}: {
  tickets: TicketWithStatus[];
  isPending: boolean;
  isError: boolean;
}) {
  if (isPending) {
    return (
      <ReportCard>
        <SectionHeader
          title="Tickets by status"
          subtitle="Share of tickets in each workflow category"
        />
        <p className="p-5 text-sm text-[#6B7280]">Loading ticket counts…</p>
      </ReportCard>
    );
  }
  if (isError) {
    return (
      <ReportCard>
        <SectionHeader
          title="Tickets by status"
          subtitle="Share of tickets in each workflow category"
        />
        <p className="p-5 text-sm text-[#6B7280]">
          Couldn&apos;t load ticket counts — the API didn&apos;t answer.
        </p>
      </ReportCard>
    );
  }
  const total = tickets.length;
  if (total === 0) {
    return (
      <ReportCard>
        <SectionHeader
          title="Tickets by status"
          subtitle="Share of tickets in each workflow category"
        />
        <p className="p-5 text-sm text-[#6B7280]">No tickets yet.</p>
      </ReportCard>
    );
  }
  const counts = STATUS_SEGMENTS.map((seg) => ({
    ...seg,
    count: tickets.filter((t) => t.status?.category === seg.key).length,
  }));
  // Outer ring first so the largest radius is drawn first.
  const rings = [
    { ...counts[0], innerRadius: 84, outerRadius: 100 },
    { ...counts[1], innerRadius: 62, outerRadius: 78 },
    { ...counts[2], innerRadius: 40, outerRadius: 56 },
  ];
  return (
    <ReportCard>
      <SectionHeader
        title="Tickets by status"
        subtitle="Share of tickets in each workflow category"
      />
      <div className="flex flex-col items-center gap-4 p-5">
        <div
          className="relative h-[220px] w-[220px] shrink-0"
          role="img"
          aria-label={`${total} tickets in total`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              {rings.map((ring) => (
                <Pie
                  key={ring.key}
                  data={[
                    { name: ring.label, value: ring.count },
                    { name: "rest", value: total - ring.count },
                  ]}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius={ring.innerRadius}
                  outerRadius={ring.outerRadius}
                  startAngle={90}
                  endAngle={-270}
                  stroke="none"
                  isAnimationActive={false}
                >
                  <Cell fill={ring.color} />
                  <Cell fill="#E9EBF3" />
                </Pie>
              ))}
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold tabular-nums text-[#111827]">{total}</span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-[#6B7280]">
              tickets
            </span>
          </div>
        </div>
        <ul className="w-full space-y-3 text-sm">
          {counts.map((seg) => (
            <li key={seg.key} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: seg.color }}
              />
              <span className="font-medium text-[#111827]">{seg.label}</span>
              <span className="ml-auto tabular-nums text-[#6B7280]">
                {seg.count} · {Math.round((seg.count / total) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </ReportCard>
  );
}

/** One sprint's time row — total hours + top members by time logged. */
function SprintTimeRow({ sprintId, name }: { sprintId: string; name: string }) {
  const query = useQuery({
    queryKey: ["reporting", "time", sprintId],
    queryFn: () => fetchTimeReport({ sprintId }),
    retry: false,
  });
  if (query.isPending) {
    return (
      <tr className="border-b border-[#E5E7EB] last:border-0">
        <td className="px-5 py-3 font-medium text-[#111827]">{name}</td>
        <td colSpan={2} className="px-5 py-3 text-[#6B7280]">
          Loading…
        </td>
      </tr>
    );
  }
  if (query.isError || !query.data) {
    return (
      <tr className="border-b border-[#E5E7EB] last:border-0">
        <td className="px-5 py-3 font-medium text-[#111827]">{name}</td>
        <td colSpan={2} className="px-5 py-3 text-[#6B7280]">
          Couldn&apos;t load time for this sprint.
        </td>
      </tr>
    );
  }
  const top = query.data.byMember.slice(0, 3);
  return (
    <tr className="border-b border-[#E5E7EB] last:border-0">
      <td className="px-5 py-3 font-medium text-[#111827]">{name}</td>
      <td className="px-5 py-3 tabular-nums text-[#111827]">
        {formatHours(query.data.totalMinutes)}
      </td>
      <td className="px-5 py-3 text-[#6B7280]">
        {top.length === 0
          ? "No time logged yet"
          : top.map((m) => `${m.memberName} ${formatHours(m.minutes)}`).join(" · ")}
      </td>
    </tr>
  );
}

/** Reports page — real data from the reporting API plus ticket counts
 *  grouped per project. No placeholder sections. Pin 3 DealDeck skin:
 *  lavender-grey page, 2x2 KPI block with one filled royal-blue card,
 *  status donut beside the velocity chart, tables below. */
export function ReportsPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: fetchDashboardSummary,
    retry: false,
  });
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
    retry: false,
  });
  const ticketsQuery = useQuery({
    queryKey: ["tickets"],
    queryFn: () => fetchTickets(),
    retry: false,
  });
  const sprintsQuery = useQuery({
    queryKey: ["sprints"],
    queryFn: fetchSprints,
    retry: false,
  });
  const timeQuery = useQuery({
    queryKey: ["reporting", "time"],
    queryFn: () => fetchTimeReport(),
    retry: false,
  });

  const projects = projectsQuery.data ?? [];
  const tickets = ticketsQuery.data ?? [];
  const counts = projects.map((p) => {
    const mine = tickets.filter((t) => t.projectId === p.id);
    return {
      project: p,
      total: mine.length,
      done: mine.filter((t) => t.status?.category === "DONE").length,
    };
  });

  const activeMembers = (data?.members ?? []).filter((m) => m.status === "ACTIVE").length;

  return (
    <div className="flex min-h-full flex-col bg-[#E9EBF3]">
      <TopBar title="Reports" />
      <main className="space-y-4 p-5 sm:p-6">
        {/* Page header — title + subtitle + date / scope controls.
            The date is the real reporting date from the summary; the
            pills are labels of the current scope, not fake filters. */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[#111827]">Reports</h1>
            <p className="mt-0.5 text-xs text-[#6B7280]">
              Sprint performance, workload and time across all projects
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {data ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#111827]">
                <Calendar size={13} className="text-[#3B5BFF]" aria-hidden />
                {data.today.date}
              </span>
            ) : null}
            <span className="inline-flex items-center rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#111827]">
              All projects
            </span>
          </div>
        </div>

        {isPending ? (
          <ReportCard className="p-6 text-sm text-[#6B7280]">Loading reports…</ReportCard>
        ) : isError || !data ? (
          <ReportCard className="p-6 text-sm text-[#6B7280]">
            Reports need the API running — see the Home page for how to start it.
          </ReportCard>
        ) : (
          <>
            {/* 2x2 KPI block — one filled royal-blue card + 3 white cards. */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <KpiCard
                label="Tickets done"
                value={data.kpis.ticketsDoneThisSprint}
                subtitle="Completed this sprint"
                deltaText={formatDelta(data.kpis.ticketsDoneDelta)}
                deltaTone="on-blue"
                icon={CheckCircle2}
                filled
              />
              <KpiCard
                label="Velocity"
                value={data.kpis.velocityPoints}
                suffix="pts"
                subtitle="Story points this sprint"
                deltaText={formatDelta(data.kpis.velocityDelta)}
                deltaTone={data.kpis.velocityDelta >= 0 ? "green" : "red"}
                icon={Zap}
              />
              <KpiCard
                label="Members active"
                value={activeMembers}
                subtitle={`Of ${data.members.length} members in the workspace`}
                deltaText={
                  data.today.updatedMembers > 0
                    ? `+${data.today.updatedMembers} updated today`
                    : "No updates today"
                }
                deltaTone={data.today.updatedMembers > 0 ? "green" : "grey"}
                icon={Users}
              />
              <KpiCard
                label="Overdue tickets"
                value={data.kpis.overdueTickets}
                subtitle="Tickets past their due date"
                deltaText={data.kpis.overdueTickets > 0 ? "Needs attention" : "All clear"}
                deltaTone={data.kpis.overdueTickets > 0 ? "red" : "green"}
                icon={Clock}
              />
            </div>

            {/* Donut beside the velocity chart. */}
            <div className="grid gap-4 lg:grid-cols-2">
              <TicketsByStatusDonut
                tickets={tickets}
                isPending={ticketsQuery.isPending}
                isError={ticketsQuery.isError}
              />
              <VelocityChart data={data.velocity} />
            </div>

            {/* Tickets per project, restyled. */}
            <ReportCard>
              <SectionHeader
                title="Tickets per project"
                subtitle="Open vs done by board category"
              />
              {ticketsQuery.isPending || projectsQuery.isPending ? (
                <p className="p-5 text-sm text-[#6B7280]">Loading ticket counts…</p>
              ) : ticketsQuery.isError || projectsQuery.isError ? (
                <p className="p-5 text-sm text-[#6B7280]">
                  Couldn&apos;t load ticket counts — the API didn&apos;t answer.
                </p>
              ) : counts.length === 0 ? (
                <p className="p-5 text-sm text-[#6B7280]">No projects yet.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] text-xs uppercase text-[#6B7280]">
                      <th className="px-5 py-3 font-medium">Project</th>
                      <th className="px-5 py-3 font-medium">Total</th>
                      <th className="px-5 py-3 font-medium">Done</th>
                      <th className="px-5 py-3 font-medium">Open</th>
                    </tr>
                  </thead>
                  <tbody>
                    {counts.map(({ project, total, done }) => (
                      <tr
                        key={project.id}
                        className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F1F5F9]"
                      >
                        <td className="px-5 py-3">
                          <p className="font-medium text-[#111827]">{project.name}</p>
                          <p className="text-xs text-[#6B7280]">{project.key}</p>
                        </td>
                        <td className="px-5 py-3 tabular-nums text-[#111827]">{total}</td>
                        <td className="px-5 py-3 font-medium tabular-nums text-[#16A34A]">
                          {done}
                        </td>
                        <td className="px-5 py-3 tabular-nums text-[#111827]">{total - done}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </ReportCard>

            <MembersTable members={data.members} />

            <ReportCard>
              <SectionHeader
                title="Time per sprint"
                subtitle="Hours logged (ticket entries + daily-update sync) and top members by time"
              />
              {sprintsQuery.isPending ? (
                <p className="p-5 text-sm text-[#6B7280]">Loading sprints…</p>
              ) : sprintsQuery.isError ? (
                <p className="p-5 text-sm text-[#6B7280]">
                  Couldn&apos;t load sprints — the API didn&apos;t answer.
                </p>
              ) : (sprintsQuery.data ?? []).length === 0 ? (
                <p className="p-5 text-sm text-[#6B7280]">No sprints yet.</p>
              ) : (
                <>
                  <p className="px-5 pt-4 text-sm text-[#6B7280]">
                    Workspace total:{" "}
                    <span className="font-semibold text-[#111827]">
                      {timeQuery.data ? formatHours(timeQuery.data.totalMinutes) : "…"}
                    </span>
                    {timeQuery.data?.byMember[0]
                      ? ` · Top: ${timeQuery.data.byMember[0].memberName} ${formatHours(timeQuery.data.byMember[0].minutes)}`
                      : ""}
                  </p>
                  <table className="mt-2 w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#E5E7EB] text-xs uppercase text-[#6B7280]">
                        <th className="px-5 py-3 font-medium">Sprint</th>
                        <th className="px-5 py-3 font-medium">Total time</th>
                        <th className="px-5 py-3 font-medium">Top members</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(sprintsQuery.data ?? []).map((s) => (
                        <SprintTimeRow key={s.id} sprintId={s.id} name={s.name} />
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </ReportCard>
          </>
        )}
      </main>
    </div>
  );
}
