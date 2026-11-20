import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader } from "../components/ui";
import { TopBar } from "../components/layout";
import {
  fetchAdminAuditLogs,
  fetchAdminHealth,
  fetchAdminOrganisations,
  fetchAdminUsers,
} from "../lib/api";

/** Platform Admin — real data from the admin API
 *  (GET /api/v1/admin/organisations, /users, /audit-logs, /health).
 *  Guarded by the PLATFORM_ADMIN role. No impersonation: a platform admin
 *  sees platform-wide lists, never signs in as a tenant user. Support access,
 *  if ever built, must be explicit, logged, and tenant-consented (SECURITY.md). */
export function AdminPage() {
  const orgsQuery = useQuery({
    queryKey: ["admin", "organisations"],
    queryFn: fetchAdminOrganisations,
    retry: false,
  });
  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: fetchAdminUsers,
    retry: false,
  });
  const auditQuery = useQuery({
    queryKey: ["admin", "audit-logs"],
    queryFn: fetchAdminAuditLogs,
    retry: false,
  });
  const healthQuery = useQuery({
    queryKey: ["admin", "health"],
    queryFn: fetchAdminHealth,
    retry: false,
  });

  const orgs = orgsQuery.data ?? [];
  const users = usersQuery.data ?? [];
  const auditLogs = auditQuery.data ?? [];
  const healthy = healthQuery.data?.status?.toLowerCase() === "ok";

  return (
    <div className="flex min-h-full flex-col bg-[#E9EEF5]">
      <TopBar title="Platform Admin" />
      <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:px-6">
        <header>
          <p className="text-xs font-medium text-[#6B7280]">Platform / Admin</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#111827]">Platform Admin</h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            The whole platform, not one workspace — tenants, users, health and the audit log.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#6B7280]">
              Tenants
            </p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-[#111827]">
              {orgsQuery.isPending ? "—" : orgs.length}
            </p>
            <p className="mt-0.5 text-xs text-[#6B7280]">Organisations on the platform</p>
          </Card>
          <Card className="p-5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#6B7280]">Users</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-[#111827]">
              {usersQuery.isPending ? "—" : users.length}
            </p>
            <p className="mt-0.5 text-xs text-[#6B7280]">Accounts across all workspaces</p>
          </Card>
          <Card className="p-5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#6B7280]">
              System health
            </p>
            <p className="mt-1 flex items-center gap-2">
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  healthQuery.isPending
                    ? "bg-[#F2F3F7] text-[#6B7280]"
                    : healthy
                      ? "bg-[#DCFCE7] text-[#16A34A]"
                      : "bg-[#FEE2E2] text-[#DC2626]"
                }`}
              >
                {healthQuery.isPending ? "Checking…" : (healthQuery.data?.status ?? "Unknown")}
              </span>
            </p>
            <p className="mt-0.5 text-xs text-[#6B7280]">
              {healthQuery.data
                ? `${healthQuery.data.service} · ${new Date(healthQuery.data.time).toLocaleString()}`
                : "API health check"}
            </p>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <CardHeader title="Organisations / tenants" subtitle="Plans, members, projects" />
          {orgsQuery.isPending ? (
            <p className="p-5 text-sm text-[#6B7280]">Loading tenants…</p>
          ) : orgsQuery.isError || !orgsQuery.data ? (
            <p className="p-5 text-sm text-[#6B7280]">
              The admin API isn't reachable or you're not signed in as a platform admin. Start the
              API and sign in with a PLATFORM_ADMIN account.
            </p>
          ) : orgs.length === 0 ? (
            <p className="p-5 text-sm text-[#6B7280]">No organisations yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[#E5E7EB] text-[11px] uppercase tracking-wide text-[#6B7280]">
                    <th className="px-5 py-3 font-medium">Tenant</th>
                    <th className="px-5 py-3 font-medium">Members</th>
                    <th className="px-5 py-3 font-medium">Projects</th>
                  </tr>
                </thead>
                <tbody>
                  {orgs.map((t) => (
                    <tr key={t.id} className="border-b border-[#E5E7EB] last:border-0">
                      <td className="px-5 py-3 font-medium text-[#111827]">{t.name}</td>
                      <td className="px-5 py-3 text-[#111827]">{t.members}</td>
                      <td className="px-5 py-3 text-[#111827]">{t.projects}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Users" subtitle="Every account on the platform" />
          {usersQuery.isPending ? (
            <p className="p-5 text-sm text-[#6B7280]">Loading users…</p>
          ) : usersQuery.isError || !usersQuery.data ? (
            <p className="p-5 text-sm text-[#6B7280]">Couldn't load users.</p>
          ) : users.length === 0 ? (
            <p className="p-5 text-sm text-[#6B7280]">No users yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[#E5E7EB] text-[11px] uppercase tracking-wide text-[#6B7280]">
                    <th className="px-5 py-3 font-medium">User</th>
                    <th className="px-5 py-3 font-medium">Workspaces</th>
                    <th className="px-5 py-3 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-[#E5E7EB] last:border-0">
                      <td className="px-5 py-3">
                        <p className="font-medium text-[#111827]">{u.name}</p>
                        <p className="text-xs text-[#6B7280]">{u.email}</p>
                      </td>
                      <td className="px-5 py-3 text-[#111827]">
                        {u.memberships.map((m) => m.organisation.name).join(", ") || "—"}
                      </td>
                      <td className="px-5 py-3 text-[#111827]">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Audit log" subtitle="Latest platform actions, newest first" />
          {auditQuery.isPending ? (
            <p className="p-5 text-sm text-[#6B7280]">Loading audit log…</p>
          ) : auditQuery.isError || !auditQuery.data ? (
            <p className="p-5 text-sm text-[#6B7280]">Couldn't load the audit log.</p>
          ) : auditLogs.length === 0 ? (
            <p className="p-5 text-sm text-[#6B7280]">No audit entries yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[#E5E7EB] text-[11px] uppercase tracking-wide text-[#6B7280]">
                    <th className="px-5 py-3 font-medium">Action</th>
                    <th className="px-5 py-3 font-medium">Entity</th>
                    <th className="px-5 py-3 font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.slice(0, 25).map((a) => (
                    <tr key={a.id} className="border-b border-[#E5E7EB] last:border-0">
                      <td className="px-5 py-3">
                        <span className="inline-flex rounded-full bg-[#EFEAFE] px-2 py-0.5 text-[11px] font-medium text-[#6C5CE7]">
                          {a.action}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[#6B7280]">
                        {a.entity}
                        {a.entityId ? ` · ${a.entityId.slice(0, 8)}…` : ""}
                      </td>
                      <td className="px-5 py-3 text-[#111827]">
                        {new Date(a.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
