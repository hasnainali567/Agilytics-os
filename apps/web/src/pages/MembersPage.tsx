import { useQuery } from "@tanstack/react-query";
import { TopBar } from "../components/layout";
import { Card, CardHeader, StatusPill } from "../components/ui";
import { fetchDashboardSummary, fetchMembers } from "../lib/api";

/** Members — the workspace roster from GET /identity/me, enriched with
 *  workload from the reporting dashboard summary (active tickets,
 *  points done, status). No invite flow here — that is a later slice. */
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
    <div className="flex min-h-screen flex-col">
      <TopBar title="Members" />
      <main className="space-y-4 p-6">
        <Card>
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
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase text-muted">
                  <th className="px-5 py-3 font-medium">Member</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Active tickets</th>
                  <th className="px-5 py-3 font-medium">Points done</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const w = workload.get(m.userId);
                  return (
                    <tr key={m.membershipId} className="border-b border-line last:border-0">
                      <td className="px-5 py-3">
                        <p className="font-medium text-ink">{m.name}</p>
                        <p className="text-xs text-muted">{m.email}</p>
                      </td>
                      <td className="px-5 py-3 text-muted">{m.role}</td>
                      <td className="px-5 py-3">{w?.activeTickets ?? 0}</td>
                      <td className="px-5 py-3">{w?.completedPoints ?? 0}</td>
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
