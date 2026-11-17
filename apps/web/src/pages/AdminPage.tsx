import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader } from "../components/ui";
import { TopBar } from "../components/layout";
import { fetchAdminOrganisations } from "../lib/api";

/** Platform Admin — real data from GET /api/v1/admin/organisations.
 *  Guarded by the PLATFORM_ADMIN role. No impersonation: a platform admin
 *  sees platform-wide lists, never signs in as a tenant user. Support access,
 *  if ever built, must be explicit, logged, and tenant-consented (SECURITY.md). */
export function AdminPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["admin", "organisations"],
    queryFn: fetchAdminOrganisations,
    retry: false,
  });

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar title="Platform Admin — whole platform, not one workspace" />
      <main className="space-y-4 p-6">
        <Card>
          <CardHeader title="Organisations / tenants" subtitle="Plans, members, projects" />
          {isPending ? (
            <p className="p-5 text-sm text-muted">Loading tenants…</p>
          ) : isError || !data ? (
            <p className="p-5 text-sm text-muted">
              The admin API isn't reachable or you're not signed in as a platform admin. Start the
              API and sign in with a PLATFORM_ADMIN account.
            </p>
          ) : data.length === 0 ? (
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
                {data.map((t) => (
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
          <CardHeader
            title="Users, audit log, subscriptions, feature flags"
            subtitle="Placeholder sections"
          />
          <p className="p-5 text-sm text-muted">
            Users and audit-log viewers call the matching admin API endpoints (see apps/api admin
            module). Plans and feature flags land once the admin API is live.
          </p>
        </Card>
      </main>
    </div>
  );
}
