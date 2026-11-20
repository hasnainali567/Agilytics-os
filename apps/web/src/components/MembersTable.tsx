import type { Member } from "@agilytics/shared";
import { Card, CardHeader, StatusPill } from "./ui";

/**
 * Members table — Kanban main design: white 18px cards, a 13px table
 * with muted uppercase headers and hairline dividers, 11–12px status
 * pills, and a purple-tinted initials avatar per member.
 * Used by ReportsPage; the roster itself lives on MembersPage.
 */
export function MembersTable({ members }: { members: Member[] }) {
  const atRisk = members.filter((m) => m.status === "AT_RISK" || m.status === "OVERLOADED");
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="overflow-hidden lg:col-span-2">
        <CardHeader title="Members" subtitle="Workload and status this sprint" />
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
            {members.map((m) => (
              <tr
                key={m.id}
                className="border-b border-line last:border-0 hover:bg-[#F7F8FA]"
              >
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
                <td className="px-5 py-3 tabular-nums text-ink">{m.activeTickets}</td>
                <td className="px-5 py-3 tabular-nums text-ink">{m.completedPoints}</td>
                <td className="px-5 py-3">
                  <StatusPill status={m.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <CardHeader title="At risk" subtitle="Members who need attention this sprint" />
        <ul className="space-y-3 p-5 text-sm">
          {atRisk.length === 0 ? (
            <li className="text-muted">No members at risk right now.</li>
          ) : (
            atRisk.map((m) => (
              <li key={m.id} className="rounded-inner bg-pill p-4">
                <p className="flex items-center gap-2 font-medium text-ink">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      m.status === "OVERLOADED" ? "bg-risk" : "bg-warn"
                    }`}
                    aria-hidden
                  />
                  {m.name}
                </p>
                <p className="mt-1 text-xs text-muted">
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
