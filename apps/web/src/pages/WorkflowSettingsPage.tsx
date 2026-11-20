import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "../components/layout";
import { Button, Card, CardHeader, Field, Input, Select } from "../components/ui";
import { addBoardColumn, fetchBoards, updateBoardColumn, type BoardWithColumns } from "../lib/api";

type Category = "TODO" | "IN_PROGRESS" | "DONE";

const CATEGORY_LABELS: Record<Category, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  DONE: "Done",
};

const CATEGORY_PILL: Record<Category, string> = {
  TODO: "bg-[#F2F3F7] text-[#6B7280]",
  IN_PROGRESS: "bg-[#EFEAFE] text-[#6C5CE7]",
  DONE: "bg-[#DCFCE7] text-[#16A34A]",
};

/** Add-column form for one board — POST /boards/:id/columns. */
function AddColumnForm({ boardId }: { boardId: string }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("TODO");
  const [colour, setColour] = useState("#64748B");
  const [error, setError] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: () => addBoardColumn(boardId, { name: name.trim(), category, colour }),
    onSuccess: () => {
      setName("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["boards"] });
    },
    onError: (err) => setError(err.message),
  });

  return (
    <form
      className="flex flex-wrap items-end gap-3 border-t border-[#E5E7EB] bg-[#E9EEF5]/60 px-5 py-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        if (!name.trim()) {
          setError("Give the column a name.");
          return;
        }
        add.mutate();
      }}
    >
      <Field label="New column" className="w-48">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Blocked"
          className="w-full"
        />
      </Field>
      <Field label="Reporting category" className="w-40">
        <Select
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          aria-label="Reporting category"
        >
          {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Colour">
        <input
          type="color"
          value={colour}
          onChange={(e) => setColour(e.target.value)}
          className="block h-10 w-14 rounded-[12px] border border-[#E5E7EB] bg-white px-1 outline-none focus:border-[#6C5CE7] focus:ring-4 focus:ring-[#6C5CE7]/10"
          aria-label="Column colour"
        />
      </Field>
      <button
        type="submit"
        className="rounded-[10px] bg-[#6C5CE7] px-4 py-2 text-sm font-medium text-white shadow-[0_1px_2px_rgba(108,92,231,0.4)] transition-colors hover:bg-[#5B4BD6] disabled:opacity-50"
        disabled={add.isPending}
      >
        Add column
      </button>
      {error ? <p className="w-full text-sm text-[#EF4444]">{error}</p> : null}
    </form>
  );
}

/** One board with its columns — rename inline, add a column below. */
function BoardCard({ board }: { board: BoardWithColumns }) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const rename = useMutation({
    mutationFn: ({ columnId, name }: { columnId: string; name: string }) =>
      updateBoardColumn(board.id, columnId, { name }),
    onSuccess: () => {
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["boards"] });
    },
  });

  return (
    <Card key={board.id} className="overflow-hidden">
      <CardHeader title={board.name} subtitle={board.isDefault ? "Default board" : "Board"} />
      <ul className="space-y-2 p-5 text-sm">
        {board.columns.map((c) => (
          <li
            key={c.id}
            className="flex flex-wrap items-center gap-2 rounded-[12px] border border-[#E5E7EB] bg-white px-3 py-2"
          >
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: c.colour }}
            />
            {editingId === c.id ? (
              <>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-48"
                  aria-label="Column name"
                />
                <Button
                  variant="secondary"
                  onClick={() => rename.mutate({ columnId: c.id, name: editName.trim() })}
                >
                  Save
                </Button>
                <Button variant="secondary" onClick={() => setEditingId(null)}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <span className="font-medium text-[#111827]">{c.name}</span>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${CATEGORY_PILL[c.category as Category] ?? "bg-[#F2F3F7] text-[#6B7280]"}`}
                >
                  {CATEGORY_LABELS[c.category as Category] ??
                    c.category.replaceAll("_", " ").toLowerCase()}
                </span>
                <span className="text-xs text-[#6B7280]">order {c.order}</span>
                <span className="ml-auto">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEditingId(c.id);
                      setEditName(c.name);
                    }}
                  >
                    Rename
                  </Button>
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
      {rename.isError ? (
        <p className="border-t border-[#E5E7EB] bg-[#FEE2E2]/60 px-5 py-3 text-sm text-[#DC2626]">
          Couldn't rename that column — {rename.error?.message ?? "the API refused it"}.
        </p>
      ) : null}
      <AddColumnForm boardId={board.id} />
    </Card>
  );
}

/**
 * Workflow settings — how a workspace admin sees their boards.
 * Boards and columns are unlimited and fully editable by the workspace
 * admin / company head (NOT the platform admin): rename, add, remove.
 * Column names are free text; the category is what reporting reads.
 * Mutations live in the API (POST/PATCH/DELETE /boards/…) — see
 * docs/WORKFLOWS.md.
 */
export function WorkflowSettingsPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["boards"],
    queryFn: () => fetchBoards(),
    retry: false,
  });

  return (
    <div className="flex min-h-full flex-col bg-[#E9EEF5]">
      <TopBar title="Workflow settings" />
      <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:px-6">
        <header>
          <p className="text-xs font-medium text-[#6B7280]">Settings / Workflows</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#111827]">
            Workflow settings
          </h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Custom workflows — owned by your company, not by us. Rename, add or remove any status.
          </p>
        </header>

        <Card className="p-5 text-sm">
          <p className="font-semibold text-[#111827]">
            Every project gets a default board (Backlog / To Do / In Progress / Review / Done).
          </p>
          <p className="mt-1 text-[#6B7280]">
            Your workspace admin can create more boards, and rename, add or remove any status —
            names have no restrictions. Only the category (to do / in progress / done) drives
            reporting, so dashboards keep working whatever you call things.
          </p>
        </Card>
        {isPending ? (
          <Card className="p-6 text-sm text-[#6B7280]">Loading boards…</Card>
        ) : isError || !data ? (
          <Card className="p-6 text-sm text-[#6B7280]">
            The API isn't reachable yet — start the API and sign in.
          </Card>
        ) : data.length === 0 ? (
          <Card className="p-6 text-sm text-[#6B7280]">
            No boards yet — create a project and its default board appears here.
          </Card>
        ) : (
          data.map((board) => <BoardCard key={board.id} board={board} />)
        )}
      </main>
    </div>
  );
}
