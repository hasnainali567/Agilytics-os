import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "../components/layout";
import { Button, Card, CardHeader } from "../components/ui";
import {
  RoleSelect,
  RolesMatrix,
  createRole,
  deleteRole,
  fetchIdentityMe,
  fetchRoles,
  updateRole,
  type RoleSummary,
} from "../features/settings/roles-matrix";

/**
 * Roles & Permissions settings page (decision 21) — workspace admin
 * only. The company's own admin/head manages roles here, NOT the
 * platform admin. The page hides itself from callers without
 * ROLES_MANAGE, but that is cosmetic: the API's PermissionsGuard
 * enforces every create / rename / delete / toggle server-side.
 *
 * Route (add to router.tsx — this slice does not edit it):
 *   const rolesRoute = createRoute({
 *     getParentRoute: () => rootRoute,
 *     path: "/settings/roles",
 *     component: RolesPage,
 *   });
 *   // add rolesRoute to routeTree's children, and a "Roles" link to
 *   // the Sidebar nav in components/layout.tsx.
 */
export function RolesPage() {
  const queryClient = useQueryClient();
  const meQuery = useQuery({
    queryKey: ["identity-me"],
    queryFn: fetchIdentityMe,
    retry: false,
  });
  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: fetchRoles, retry: false });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [colour, setColour] = useState("#0F3D20");
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const invalidateRoles = () => {
    queryClient.invalidateQueries({ queryKey: ["roles"] });
  };

  const create = useMutation({
    mutationFn: () =>
      createRole({ name: name.trim(), description: description.trim() || undefined, colour }),
    onSuccess: () => {
      setName("");
      setDescription("");
      setFormError(null);
      invalidateRoles();
    },
    onError: (err) => setFormError(err.message),
  });

  const rename = useMutation({
    mutationFn: ({ id, newName }: { id: string; newName: string }) =>
      updateRole(id, { name: newName }),
    onSuccess: () => {
      setEditingId(null);
      invalidateRoles();
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteRole(id),
    onSuccess: invalidateRoles,
    onError: (err) => setDeleteError(err.message),
  });

  const canManage = (meQuery.data?.me.permissions ?? []).includes("ROLES_MANAGE");
  const roles = rolesQuery.data ?? [];

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar title="Roles & permissions" />
      <main className="space-y-4 p-6">
        <Card className="p-5 text-sm">
          <p className="font-semibold">Custom roles — owned by your company, not by us.</p>
          <p className="mt-1 text-muted">
            Create roles with any name, then toggle exactly the permissions each role gets. The five
            system roles (Owner, Admin, Lead, Member, Viewer) are seeded per workspace and can be
            edited, but a role in use by members cannot be deleted — reassign those members first.
          </p>
        </Card>

        {meQuery.isPending ? (
          <Card className="p-6 text-sm text-muted">Checking your permissions…</Card>
        ) : meQuery.isError || !meQuery.data ? (
          <Card className="p-6 text-sm text-muted">
            The API isn't reachable yet — start the API and sign in.
          </Card>
        ) : !canManage ? (
          <Card className="p-6 text-sm">
            <p className="font-semibold">You don't manage roles in this workspace.</p>
            <p className="mt-1 text-muted">
              Only a workspace admin (role with the <code>roles.manage</code> permission) can change
              roles. Your role: {meQuery.data.me.roleName ?? "none"}.
            </p>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader
                title="Roles"
                subtitle="System roles are seeded; custom roles are yours to name."
              />
              {deleteError ? (
                <p className="border-b border-line bg-red-50 px-5 py-3 text-sm text-red-800">
                  {deleteError}{" "}
                  <button type="button" className="underline" onClick={() => setDeleteError(null)}>
                    Dismiss
                  </button>
                </p>
              ) : null}
              <ul className="divide-y divide-line">
                {roles.map((role: RoleSummary) => (
                  <li key={role.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    {role.colour ? (
                      <span
                        className="inline-block h-3 w-3 shrink-0 rounded-full"
                        style={{ background: role.colour }}
                      />
                    ) : null}
                    {editingId === role.id ? (
                      <>
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="rounded-lg border border-line px-2 py-1 text-sm outline-none"
                          aria-label="Role name"
                        />
                        <Button
                          variant="secondary"
                          onClick={() => rename.mutate({ id: role.id, newName: editName.trim() })}
                        >
                          Save
                        </Button>
                        <Button variant="secondary" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="font-medium text-ink">{role.name}</span>
                        <span className="text-xs text-muted">
                          {role.isSystem ? "system" : "custom"} · {role.memberCount} member
                          {role.memberCount === 1 ? "" : "s"} · {role.permissions.length}{" "}
                          permissions
                        </span>
                        <span className="ml-auto flex gap-2">
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setEditingId(role.id);
                              setEditName(role.name);
                            }}
                          >
                            Rename
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setDeleteError(null);
                              if (
                                window.confirm(
                                  `Delete role "${role.name}"? This is refused while any member uses it.`,
                                )
                              ) {
                                remove.mutate(role.id);
                              }
                            }}
                          >
                            Delete
                          </Button>
                        </span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              <form
                className="flex flex-wrap items-end gap-3 border-t border-line px-5 py-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  setFormError(null);
                  create.mutate();
                }}
              >
                <label className="block text-sm">
                  <span className="font-medium text-ink">New role name</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. QA Lead"
                    className="mt-1 w-56 rounded-lg border border-line px-3 py-2 text-sm outline-none"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-ink">Description</span>
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What this role does"
                    className="mt-1 w-64 rounded-lg border border-line px-3 py-2 text-sm outline-none"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-ink">Colour</span>
                  <input
                    type="color"
                    value={colour}
                    onChange={(e) => setColour(e.target.value)}
                    className="mt-1 block h-9 w-14 rounded-lg border border-line bg-panel px-1"
                    aria-label="Role colour"
                  />
                </label>
                <Button>Create role</Button>
                {formError ? <p className="w-full text-sm text-red-700">{formError}</p> : null}
              </form>
            </Card>

            <RolesMatrix />

            <Card className="p-5 text-sm">
              <p className="font-semibold">Assigning roles to members</p>
              <p className="mt-1 text-muted">
                Pick a role on the member invite/edit screen — the same list, with the same names.
                Changing a member's role is audited, like every role change here.
              </p>
              <div className="mt-3 max-w-xs">
                <RoleSelect value="" onChange={() => {}} label="Role (preview)" />
              </div>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
