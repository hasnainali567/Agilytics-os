import { useQuery } from "@tanstack/react-query";
import { TopBar } from "../components/layout";
import { Card, CardHeader } from "../components/ui";
import { fetchBoards } from "../lib/api";

/**
 * Workflow settings (stub) — how a workspace admin sees their boards.
 * Boards and columns are unlimited and fully editable by the workspace
 * admin / company head (NOT the platform admin): rename, reorder, add,
 * remove. Column names are free text; the category is what reporting
 * reads. Mutations live in the API (PATCH/DELETE /boards/…) — this page
 * is read-only until the edit UI lands. See docs/WORKFLOWS.md.
 */
export function WorkflowSettingsPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["boards"],
    queryFn: () => fetchBoards(),
    retry: false,
  });

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar title="Workflow settings" />
      <main className="space-y-4 p-6">
        <Card className="p-5 text-sm">
          <p className="font-semibold">Custom workflows — owned by your company, not by us.</p>
          <p className="mt-1 text-muted">
            Every project gets a default board (Backlog / To Do / In Progress / Review / Done). Your
            workspace admin can create more boards, and rename, reorder, add or remove any status —
            names have no restrictions. Only the category (to do / in progress / done) drives
            reporting, so dashboards keep working whatever you call things.
          </p>
        </Card>
        {isPending ? (
          <Card className="p-6 text-sm text-muted">Loading boards…</Card>
        ) : isError || !data ? (
          <Card className="p-6 text-sm text-muted">
            The API isn't reachable yet — start the API and sign in.
          </Card>
        ) : data.length === 0 ? (
          <Card className="p-6 text-sm text-muted">
            No boards yet — create a project and its default board appears here.
          </Card>
        ) : (
          data.map((board) => (
            <Card key={board.id}>
              <CardHeader
                title={board.name}
                subtitle={board.isDefault ? "Default board" : "Board"}
              />
              <ul className="space-y-2 p-5 text-sm">
                {board.columns.map((c) => (
                  <li key={c.id} className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: c.colour }}
                    />
                    <span className="font-medium">{c.name}</span>
                    <span className="text-muted">
                      · {c.category.replaceAll("_", " ").toLowerCase()} · order {c.order}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ))
        )}
      </main>
    </div>
  );
}
