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

  return (
    <div className="flex min-h-full flex-col">
      <TopBar title="Platform Admin — whole platform, not one workspace" />
      <main className="space-y-4 p-6">
        <Card>
          <CardHeader
            title="System health"
            subtitle={
              healthQuery.data
                ? `${healthQuery.data.service} · ${healthQuery.data.status} · ${new Date(healthQuery.data.time).toLocaleString()}`
                : "API health check"
            }
          />
          {healthQuery.isPending ? (
            <p className="p-5 text-sm text-muted">Checking health…</p>
          ) : healthQuery.isError || !healthQuery.data ? (
            <p className="p-5 text-sm text-muted">
              The admin API isn't reachable or you're not signed in as a platform admin.
            </p>
          ) : (
            <p className="p-5 text-sm">
              Status: <span className="font-medium text-ink">{healthQuery.data.status}</span>
            </p>
          )}
        </Card>

        <Card>
          <CardHeader title="Organisations / tenants" subtitle="Plans, members, projects" />
          {orgsQuery.isPending ? (
            <p className="p-5 text-sm text-muted">Loading tenants…</p>
          ) : orgsQuery.isError || !orgsQuery.data ? (
            <p className="p-5 text-sm text-muted">
              The admin API isn't reachable or you're not signed in as a platform admin. Start the
              API and sign in with a PLATFORM_ADMIN account.
            </p>
          ) : orgs.length === 0 ? (
            <p className="p-5 text-sm text-muted">No organisations yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase text-muted">
                  <th className="px-5 py-3 font-medium">Tenant</th>
                  <th className="px-5 py-3 font-medium">Members</th>
                  <th className="px-5 py-3 font-medium">Projects</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((t) => (
                  <tr key={t.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 font-medium text-ink">{t.name}</td>
                    <td className="px-5 py-3">{t.members}</td>
                    <td className="px-5 py-3">{t.projects}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <CardHeader title="Users" subtitle="Every account on the platform" />
          {usersQuery.isPending ? (
            <p className="p-5 text-sm text-muted">Loading users…</p>
          ) : usersQuery.isError || !usersQuery.data ? (
            <p className="p-5 text-sm text-muted">Couldn't load users.</p>
          ) : users.length === 0 ? (
            <p className="p-5 text-sm text-muted">No users yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase text-muted">
                  <th className="px-5 py-3 font-medium">User</th>
                  <th className="px-5 py-3 font-medium">Workspaces</th>
                  <th className="px-5 py-3 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3">
                      <p className="font-medium text-ink">{u.name}</p>
                      <p className="text-xs text-muted">{u.email}</p>
                    </td>
                    <td className="px-5 py-3">
                      {u.memberships.map((m) => m.organisation.name).join(", ") || "—"}
                    </td>
                    <td className="px-5 py-3">{new Date(u.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <CardHeader title="Audit log" subtitle="Latest platform actions, newest first" />
          {auditQuery.isPending ? (
            <p className="p-5 text-sm text-muted">Loading audit log…</p>
          ) : auditQuery.isError || !auditQuery.data ? (
            <p className="p-5 text-sm text-muted">Couldn't load the audit log.</p>
          ) : auditLogs.length === 0 ? (
            <p className="p-5 text-sm text-muted">No audit entries yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase text-muted">
                  <th className="px-5 py-3 font-medium">Action</th>
                  <th className="px-5 py-3 font-medium">Entity</th>
                  <th className="px-5 py-3 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.slice(0, 25).map((a) => (
                  <tr key={a.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 font-medium text-ink">{a.action}</td>
                    <td className="px-5 py-3 text-muted">
                      {a.entity}
                      {a.entityId ? ` · ${a.entityId.slice(0, 8)}…` : ""}
                    </td>
                    <td className="px-5 py-3">{new Date(a.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </main>
    </div>
  );
}
