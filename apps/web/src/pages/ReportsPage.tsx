import { useQuery } from "@tanstack/react-query";
import type { Member } from "@agilytics/shared";
import { TopBar } from "../components/layout";
import { Card, CardHeader } from "../components/ui";
import { MembersTable } from "../components/MembersTable";
import { VelocityChart } from "../components/VelocityChart";
import {
  fetchDashboardSummary,
  fetchProjects,
  fetchSprints,
  fetchTickets,
  fetchTimeReport,
} from "../lib/api";

function formatHours(minutes: number): string {
  return `${(minutes / 60).toFixed(1)}h`;
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
      <tr className="border-b border-line last:border-0">
        <td className="px-5 py-3 font-medium text-ink">{name}</td>
        <td colSpan={2} className="px-5 py-3 text-muted">
          Loading…
        </td>
      </tr>
    );
  }
  if (query.isError || !query.data) {
    return (
      <tr className="border-b border-line last:border-0">
        <td className="px-5 py-3 font-medium text-ink">{name}</td>
        <td colSpan={2} className="px-5 py-3 text-muted">
          Couldn't load time for this sprint.
        </td>
      </tr>
    );
  }
  const top = query.data.byMember.slice(0, 3);
  return (
    <tr className="border-b border-line last:border-0">
      <td className="px-5 py-3 font-medium text-ink">{name}</td>
      <td className="px-5 py-3 tabular-nums">{formatHours(query.data.totalMinutes)}</td>
      <td className="px-5 py-3 text-muted">
        {top.length === 0
          ? "No time logged yet"
          : top.map((m) => `${m.memberName} ${formatHours(m.minutes)}`).join(" · ")}
      </td>
    </tr>
  );
}

const SEGMENT_COLORS = ["#a3e635", "#0f3d20", "#1fa463", "#ff6a2b", "#c0ee7e", "#8a8f8a"];

/** Workload donut — active tickets per member, from the dashboard summary. */
function WorkloadDonut({ members }: { members: Member[] }) {
  const active = members.filter((m) => m.activeTickets > 0);
  const total = active.reduce((sum, m) => sum + m.activeTickets, 0);
  if (total === 0) {
    return (
      <Card>
        <CardHeader title="Workload" subtitle="Active tickets per member" />
        <p className="p-5 text-sm text-muted">
          No active tickets assigned right now — workload appears once work is assigned.
        </p>
      </Card>
    );
  }
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <Card>
      <CardHeader title="Workload" subtitle="Active tickets per member" />
      <div className="flex flex-wrap items-center gap-5 p-5">
        <div
          className="relative h-32 w-32 shrink-0"
          role="img"
          aria-label={`${total} active tickets across ${active.length} members`}
        >
          <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
            <circle cx="64" cy="64" r={radius} fill="none" stroke="#e3e6e3" strokeWidth="16" />
            {active.map((m, i) => {
              const fraction = m.activeTickets / total;
              const dash = fraction * circumference;
              const el = (
                <circle
                  key={m.id}
                  cx="64"
                  cy="64"
                  r={radius}
                  fill="none"
                  stroke={SEGMENT_COLORS[i % SEGMENT_COLORS.length]}
                  strokeWidth="16"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += dash;
              return el;
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold tabular-nums text-ink">{total}</span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted">
              active
            </span>
          </div>
        </div>
        <ul className="min-w-36 flex-1 space-y-2 text-sm">
          {active.slice(0, 6).map((m, i) => (
            <li key={m.id} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
              />
              <span className="font-medium text-ink">{m.name}</span>
              <span className="ml-auto text-muted">
                {m.activeTickets} ticket{m.activeTickets === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

/** Reports page — real data from the reporting API plus ticket counts
 *  grouped per project. No placeholder sections. */
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

  return (
    <div className="flex min-h-full flex-col">
      <TopBar title="Reports" />
      <main className="space-y-4 p-6">
        {isPending ? (
          <Card className="p-6 text-sm text-muted">Loading reports…</Card>
        ) : isError || !data ? (
          <Card className="p-6 text-sm text-muted">
            Reports need the API running — see the Home page for how to start it.
          </Card>
        ) : (
          <>
            <VelocityChart data={data.velocity} />
            <div className="grid gap-4 lg:grid-cols-2">
              <WorkloadDonut members={data.members} />
              <Card>
                <CardHeader title="Tickets per project" subtitle="Open vs done by board category" />
                {ticketsQuery.isPending || projectsQuery.isPending ? (
                  <p className="p-5 text-sm text-muted">Loading ticket counts…</p>
                ) : ticketsQuery.isError || projectsQuery.isError ? (
                  <p className="p-5 text-sm text-muted">
                    Couldn't load ticket counts — the API didn't answer.
                  </p>
                ) : counts.length === 0 ? (
                  <p className="p-5 text-sm text-muted">No projects yet.</p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-line text-xs uppercase text-muted">
                        <th className="px-5 py-3 font-medium">Project</th>
                        <th className="px-5 py-3 font-medium">Total</th>
                        <th className="px-5 py-3 font-medium">Done</th>
                        <th className="px-5 py-3 font-medium">Open</th>
                      </tr>
                    </thead>
                    <tbody>
                      {counts.map(({ project, total, done }) => (
                        <tr key={project.id} className="border-b border-line last:border-0">
                          <td className="px-5 py-3">
                            <p className="font-medium text-ink">{project.name}</p>
                            <p className="text-xs text-muted">{project.key}</p>
                          </td>
                          <td className="px-5 py-3">{total}</td>
                          <td className="px-5 py-3">{done}</td>
                          <td className="px-5 py-3">{total - done}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            </div>
            <MembersTable members={data.members} />
            <Card>
              <CardHeader
                title="Time per sprint"
                subtitle="Hours logged (ticket entries + daily-update sync) and top members by time"
              />
              {sprintsQuery.isPending ? (
                <p className="p-5 text-sm text-muted">Loading sprints…</p>
              ) : sprintsQuery.isError ? (
                <p className="p-5 text-sm text-muted">
                  Couldn't load sprints — the API didn't answer.
                </p>
              ) : (sprintsQuery.data ?? []).length === 0 ? (
                <p className="p-5 text-sm text-muted">No sprints yet.</p>
              ) : (
                <>
                  <p className="px-5 pt-4 text-sm text-muted">
                    Workspace total:{" "}
                    <span className="font-semibold text-ink">
                      {timeQuery.data ? formatHours(timeQuery.data.totalMinutes) : "…"}
                    </span>
                    {timeQuery.data?.byMember[0]
                      ? ` · Top: ${timeQuery.data.byMember[0].memberName} ${formatHours(timeQuery.data.byMember[0].minutes)}`
                      : ""}
                  </p>
                  <table className="mt-2 w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-line text-xs uppercase text-muted">
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
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
