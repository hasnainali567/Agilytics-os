import { Fragment } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "../../lib/query-client";
import { apiFetch } from "../../lib/authFetch";
import { Button, Card, CardHeader } from "../../components/ui";

/**
 * Roles & Permissions matrix (decision 21) + role dropdown.
 *
 * API helpers live here (not in lib/api.ts — that file belongs to
 * another slice). They follow the existing web pattern: apiFetch
 * against `apiUrl`, with the stored Bearer token attached. The API's
 * PermissionsGuard is the enforcement point, so a request without a
 * valid JWT (or without ROLES_MANAGE) is denied server-side regardless
 * of what this UI shows.
 */

export interface RoleSummary {
  id: string;
  name: string;
  description: string | null;
  colour: string | null;
  isSystem: boolean;
  memberCount: number;
  permissions: string[];
}

export interface PermissionDefinition {
  key: string;
  label: string;
  area: string;
  description: string;
}

export interface PermissionCatalog {
  areas: { area: string; permissions: PermissionDefinition[] }[];
  total: number;
}

export interface IdentityMe {
  userId: string | null;
  roleId: string | null;
  roleName: string | null;
  permissions: string[];
}

async function api<T>(path: string, init?: Omit<RequestInit, "headers">): Promise<T> {
  const res = await apiFetch(`${apiUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    let detail = `Request failed: ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string | string[] };
      if (typeof body.message === "string") detail = body.message;
      else if (Array.isArray(body.message)) detail = body.message.join(", ");
    } catch {
      // Keep the status-based message.
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

export function fetchRoles(): Promise<RoleSummary[]> {
  return api<RoleSummary[]>("/roles");
}

export function fetchPermissionCatalog(): Promise<PermissionCatalog> {
  return api<PermissionCatalog>("/roles/permissions");
}

export function fetchIdentityMe(): Promise<{ me: IdentityMe }> {
  return api<{ me: IdentityMe }>("/identity/me");
}

export function createRole(data: {
  name: string;
  description?: string;
  colour?: string;
  permissions?: string[];
}): Promise<RoleSummary> {
  return api<RoleSummary>("/roles", { method: "POST", body: JSON.stringify(data) });
}

export function updateRole(
  roleId: string,
  data: { name?: string; description?: string | null; colour?: string | null },
): Promise<RoleSummary> {
  return api<RoleSummary>(`/roles/${roleId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteRole(roleId: string): Promise<{ deleted: string }> {
  return api<{ deleted: string }>(`/roles/${roleId}`, { method: "DELETE" });
}

export function replaceRolePermissions(
  roleId: string,
  permissions: string[],
): Promise<RoleSummary> {
  return api<RoleSummary>(`/roles/${roleId}/permissions`, {
    method: "PUT",
    body: JSON.stringify({ permissions }),
  });
}

export function assignMemberRole(membershipId: string, roleId: string): Promise<unknown> {
  return api(`/roles/members/${membershipId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ roleId }),
  });
}

const AREA_LABELS: Record<string, string> = {
  workspace: "Workspace, members, roles, teams",
  projects: "Projects",
  boards: "Boards / workflows",
  tickets: "Tickets",
  sprints: "Sprints",
  daily_updates: "Daily updates",
  docs: "Project docs",
  reporting: "Reporting",
  integrations: "Integrations, automations, import",
  ai: "AI",
  time: "Time tracking",
};

/**
 * Role dropdown for the member invite/edit screen. Lists workspace
 * roles (system + custom); the caller assigns via
 * PATCH /roles/members/:membershipId/role. The API enforces
 * MEMBERS_ASSIGN_ROLE — this dropdown only decides what to show.
 */
export function RoleSelect({
  value,
  onChange,
  label = "Role",
}: {
  value: string;
  onChange: (roleId: string) => void;
  label?: string;
}) {
  const { data, isPending, isError } = useQuery({
    queryKey: ["roles"],
    queryFn: fetchRoles,
    retry: false,
  });

  return (
    <label className="block text-sm">
      <span className="font-medium text-ink">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={isPending || isError}
        className="mt-1 w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none disabled:opacity-50"
      >
        <option value="">
          {isPending ? "Loading roles…" : isError ? "Could not load roles" : "Select a role"}
        </option>
        {(data ?? []).map((role) => (
          <option key={role.id} value={role.id}>
            {role.name}
            {role.isSystem ? " (system)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Roles × permissions matrix: roles as columns, permissions as rows
 * grouped by area, one toggle per cell. Toggling saves immediately
 * (PUT /roles/:id/permissions replaces the whole set); a failed save
 * rolls the matrix back to the server state.
 *
 * Hiding a toggle here is cosmetic — the API's PermissionsGuard
 * enforces every change, and a caller without ROLES_MANAGE gets a
 * 403 from the toggle save.
 */
export function RolesMatrix() {
  const queryClient = useQueryClient();
  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: fetchRoles, retry: false });
  const catalogQuery = useQuery({
    queryKey: ["permission-catalog"],
    queryFn: fetchPermissionCatalog,
    retry: false,
  });

  const save = useMutation({
    mutationFn: ({ roleId, permissions }: { roleId: string; permissions: string[] }) =>
      replaceRolePermissions(roleId, permissions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
  });

  const roles = rolesQuery.data ?? [];
  const catalog = catalogQuery.data;

  if (rolesQuery.isPending || catalogQuery.isPending) {
    return <Card className="p-6 text-sm text-muted">Loading roles…</Card>;
  }
  if (rolesQuery.isError || catalogQuery.isError || !catalog) {
    return (
      <Card className="p-6 text-sm text-muted">
        The API isn't reachable yet — start the API and sign in.
      </Card>
    );
  }
  if (roles.length === 0) {
    return (
      <Card className="p-6 text-sm text-muted">
        No roles yet — the five system roles are seeded when the workspace is created. If this
        workspace predates seeding, ask an admin to run the seed.
      </Card>
    );
  }

  const toggle = (role: RoleSummary, key: string) => {
    const has = role.permissions.includes(key);
    const next = has ? role.permissions.filter((k) => k !== key) : [...role.permissions, key];
    save.mutate({ roleId: role.id, permissions: next });
  };

  return (
    <Card>
      <CardHeader
        title="Permissions matrix"
        subtitle="Toggle a permission to grant or revoke it. Changes save immediately and are written to the audit log."
      />
      {save.isError ? (
        <p className="border-b border-line bg-red-50 px-5 py-3 text-sm text-red-800">
          Could not save that change — {save.error?.message ?? "the API refused it"}. The matrix
          shows the server state.
        </p>
      ) : null}
      <div className="overflow-x-auto p-5">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase text-muted">
              <th className="py-2 pr-3 font-medium">Permission</th>
              {roles.map((role) => (
                <th key={role.id} className="px-2 py-2 text-center font-medium normal-case">
                  <span className="inline-flex items-center gap-1.5">
                    {role.colour ? (
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ background: role.colour }}
                      />
                    ) : null}
                    {role.name}
                  </span>
                  <span className="block text-[11px] font-normal text-muted">
                    {role.isSystem ? "system" : "custom"} · {role.memberCount} member
                    {role.memberCount === 1 ? "" : "s"}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {catalog.areas.map((group) => (
              <Fragment key={group.area}>
                <tr>
                  <td
                    colSpan={roles.length + 1}
                    className="bg-canvas px-2 py-2 text-xs font-semibold uppercase tracking-wide text-muted"
                  >
                    {AREA_LABELS[group.area] ?? group.area}
                  </td>
                </tr>
                {group.permissions.map((perm) => (
                  <tr key={perm.key} className="border-b border-line last:border-0">
                    <td className="py-2 pr-3">
                      <p className="font-medium text-ink">{perm.label}</p>
                      <p className="text-xs text-muted">{perm.description}</p>
                    </td>
                    {roles.map((role) => {
                      const granted = role.permissions.includes(perm.key);
                      return (
                        <td key={role.id} className="px-2 py-2 text-center">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={granted}
                            aria-label={`${perm.label} for ${role.name}`}
                            disabled={save.isPending}
                            onClick={() => toggle(role, perm.key)}
                            className={`inline-flex h-6 w-11 items-center rounded-full px-0.5 transition-colors disabled:opacity-50 ${
                              granted ? "bg-forest" : "bg-line"
                            }`}
                          >
                            <span
                              className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                                granted ? "translate-x-5" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-line px-5 py-3">
        <Button
          variant="secondary"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["roles"] })}
        >
          Refresh from server
        </Button>
      </div>
    </Card>
  );
}
