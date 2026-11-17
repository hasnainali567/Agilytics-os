import type { Member } from "@agilytics/shared";
import { Card, CardHeader, StatusPill } from "./ui";

export function MembersTable({ members }: { members: Member[] }) {
  const atRisk = members.filter((m) => m.status === "AT_RISK" || m.status === "OVERLOADED");
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Members" subtitle="Workload and status this sprint" />
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
            {members.map((m) => (
              <tr key={m.id} className="border-b border-line last:border-0">
                <td className="px-5 py-3">
                  <p className="font-medium text-ink">{m.name}</p>
                  <p className="text-xs text-muted">{m.email}</p>
                </td>
                <td className="px-5 py-3 text-muted">{m.role}</td>
                <td className="px-5 py-3">{m.activeTickets}</td>
                <td className="px-5 py-3">{m.completedPoints}</td>
                <td className="px-5 py-3">
                  <StatusPill status={m.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <CardHeader title="At risk" subtitle="AI will explain these once the API lands" />
        <ul className="space-y-3 p-5 text-sm">
          {atRisk.length === 0 ? (
            <li className="text-muted">No members at risk right now.</li>
          ) : (
            atRisk.map((m) => (
              <li key={m.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="font-medium text-ink">{m.name}</p>
                <p className="text-xs text-muted">
                  {m.activeTickets} active tickets, {m.completedPoints} points done —{" "}
                  {m.status === "OVERLOADED" ? "over capacity" : "falling behind"}
                </p>
              </li>
            ))
          )}
        </ul>
      </Card>
    </div>
  );
}
