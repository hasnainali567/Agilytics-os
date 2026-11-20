import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "../components/layout";
import { Button, Card, CardHeader, Field, Input } from "../components/ui";
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
  const [colour, setColour] = useState("#6C5CE7");
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
    <div className="flex min-h-full flex-col bg-[#E9EEF5]">
      <TopBar title="Roles & permissions" />
      <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:px-6">
        <header>
          <p className="text-xs font-medium text-[#6B7280]">Settings / Roles &amp; permissions</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#111827]">
            Roles &amp; permissions
          </h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Custom roles — owned by your company, not by us. Name a role, then toggle exactly the
            permissions it gets.
          </p>
        </header>

        <Card className="p-5 text-sm">
          <p className="font-semibold text-[#111827]">
            The five system roles (Owner, Admin, Lead, Member, Viewer) are seeded per workspace.
          </p>
          <p className="mt-1 text-[#6B7280]">
            System roles can be edited, but a role in use by members cannot be deleted — reassign
            those members first.
          </p>
        </Card>

        {meQuery.isPending ? (
          <Card className="p-6 text-sm text-[#6B7280]">Checking your permissions…</Card>
        ) : meQuery.isError || !meQuery.data ? (
          <Card className="p-6 text-sm text-[#6B7280]">
            The API isn't reachable yet — start the API and sign in.
          </Card>
        ) : !canManage ? (
          <Card className="p-6 text-sm">
            <p className="font-semibold text-[#111827]">
              You don't manage roles in this workspace.
            </p>
            <p className="mt-1 text-[#6B7280]">
              Only a workspace admin (role with the <code>roles.manage</code> permission) can change
              roles. Your role: {meQuery.data.me.roleName ?? "none"}.
            </p>
          </Card>
        ) : (
          <>
            <Card className="overflow-hidden">
              <CardHeader
                title="Roles"
                subtitle="System roles are seeded; custom roles are yours to name."
              />
              {deleteError ? (
                <p className="border-b border-[#E5E7EB] bg-[#FEE2E2]/60 px-5 py-3 text-sm text-[#DC2626]">
                  {deleteError}{" "}
                  <button type="button" className="underline" onClick={() => setDeleteError(null)}>
                    Dismiss
                  </button>
                </p>
              ) : null}
              <ul className="divide-y divide-[#E5E7EB]">
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
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-48"
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
                        <span className="font-medium text-[#111827]">{role.name}</span>
                        <span className="text-xs text-[#6B7280]">
                          <span
                            className={`mr-1.5 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              role.isSystem
                                ? "bg-[#EFEAFE] text-[#6C5CE7]"
                                : "bg-[#DCFCE7] text-[#16A34A]"
                            }`}
                          >
                            {role.isSystem ? "system" : "custom"}
                          </span>
                          {role.memberCount} member
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
                className="flex flex-wrap items-end gap-3 border-t border-[#E5E7EB] bg-[#E9EEF5]/60 px-5 py-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  setFormError(null);
                  create.mutate();
                }}
              >
                <Field label="New role name" className="w-56">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. QA Lead"
                    className="w-full"
                  />
                </Field>
                <Field label="Description" className="w-64">
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What this role does"
                    className="w-full"
                  />
                </Field>
                <Field label="Colour">
                  <input
                    type="color"
                    value={colour}
                    onChange={(e) => setColour(e.target.value)}
                    className="block h-10 w-14 rounded-[12px] border border-[#E5E7EB] bg-white px-1 outline-none focus:border-[#6C5CE7] focus:ring-4 focus:ring-[#6C5CE7]/10"
                    aria-label="Role colour"
                  />
                </Field>
                <button
                  type="submit"
                  className="rounded-[10px] bg-[#6C5CE7] px-4 py-2 text-sm font-medium text-white shadow-[0_1px_2px_rgba(108,92,231,0.4)] transition-colors hover:bg-[#5B4BD6] disabled:opacity-50"
                  disabled={create.isPending}
                >
                  Create role
                </button>
                {formError ? <p className="w-full text-sm text-[#EF4444]">{formError}</p> : null}
              </form>
            </Card>

            <RolesMatrix />

            <Card className="p-5 text-sm">
              <p className="font-semibold text-[#111827]">Assigning roles to members</p>
              <p className="mt-1 text-[#6B7280]">
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
