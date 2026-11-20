import { useQuery } from "@tanstack/react-query";
import { TopBar } from "../components/layout";
import { Card, CardHeader, StatusPill } from "../components/ui";
import { fetchDashboardSummary, fetchMembers } from "../lib/api";

/** Members — Kanban main design: white 18px card on the #E9EEF5 page,
 *  13px table with muted uppercase headers, hairline dividers and
 *  11–12px status pills, plus a purple-tinted initials avatar.
 *  The workspace roster from GET /identity/me, enriched with workload
 *  from the reporting dashboard summary (active tickets, points done,
 *  status). No invite flow here — that is a later slice. */
export function MembersPage() {
  const membersQuery = useQuery({
    queryKey: ["members"],
    queryFn: fetchMembers,
    retry: false,
  });
  const summaryQuery = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: fetchDashboardSummary,
    retry: false,
  });

  const members = membersQuery.data ?? [];
  const workload = new Map(
    (summaryQuery.data?.members ?? []).map((m) => [m.userId, m]),
  );

  return (
    <div className="flex min-h-full flex-col bg-[#E9EEF5]">
      <TopBar title="Members" />
      <main className="space-y-5 px-6 py-6 lg:px-8">
        <Card className="overflow-hidden">
          <CardHeader
            title="Workspace members"
            subtitle="Everyone in this workspace, with their current workload"
          />
          {membersQuery.isPending || summaryQuery.isPending ? (
            <p className="p-5 text-sm text-muted">Loading members…</p>
          ) : membersQuery.isError || !membersQuery.data ? (
            <p className="p-5 text-sm text-muted">
              The members API isn't reachable yet — start the API and sign in.
            </p>
          ) : members.length === 0 ? (
            <p className="p-5 text-sm text-muted">No members in this workspace yet.</p>
          ) : (
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                  <th className="px-5 py-3 font-medium">Member</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium tabular-nums">Active tickets</th>
                  <th className="px-5 py-3 font-medium tabular-nums">Points done</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const w = workload.get(m.userId);
                  return (
                    <tr key={m.membershipId} className="border-b border-line last:border-0 hover:bg-[#F7F8FA]">
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-2.5">
                          <span
                            aria-hidden
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EFEAFE] text-xs font-semibold text-[#6C5CE7]"
                          >
                            {m.name
                              .split(" ")
                              .map((part) => part[0])
                              .slice(0, 2)
                              .join("")
                              .toUpperCase()}
                          </span>
                          <span>
                            <span className="block font-medium text-ink">{m.name}</span>
                            <span className="block text-xs text-muted">{m.email}</span>
                          </span>
                        </span>
                      </td>
                      <td className="px-5 py-3 text-muted">{m.role}</td>
                      <td className="px-5 py-3 tabular-nums text-ink">{w?.activeTickets ?? 0}</td>
                      <td className="px-5 py-3 tabular-nums text-ink">{w?.completedPoints ?? 0}</td>
                      <td className="px-5 py-3">
                        <StatusPill status={w?.status ?? "ACTIVE"} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      </main>
    </div>
  );
}
