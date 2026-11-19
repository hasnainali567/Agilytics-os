import { useEffect, useState } from "react";
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createTicketSchema } from "@agilytics/shared";
import { Link } from "@tanstack/react-router";
import { TopBar } from "../components/layout";
import { DailyUpdateComposer } from "../components/DailyUpdateComposer";
import { TimeEntriesPanel } from "../components/TimeEntriesPanel";
import { Card, Field, Input, Select } from "../components/ui";
import { useRealtime } from "../lib/useRealtime";
import {
  createTicket,
  fetchBoards,
  fetchDashboardSummary,
  fetchProjects,
  fetchTickets,
  moveTicketToColumn,
  type BoardWithColumns,
  type TicketWithStatus,
} from "../lib/api";

const PRIORITY_STYLE: Record<string, string> = {
  LOW: "text-muted",
  MEDIUM: "text-ink",
  HIGH: "text-warn",
  URGENT: "text-risk",
};

function TicketCard({
  ticket,
  selected,
  onSelect,
}: {
  ticket: TicketWithStatus;
  selected: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: ticket.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onSelect}
      className={`cursor-pointer rounded-lg border p-3 text-sm ${
        selected ? "border-forest bg-lime/30" : "border-line bg-panel"
      }`}
    >
      <p className="text-xs font-medium text-muted">{ticket.key}</p>
      <p className="mt-0.5 font-medium text-ink">{ticket.title}</p>
      <p className={`mt-1 text-xs font-medium ${PRIORITY_STYLE[ticket.priority] ?? "text-muted"}`}>
        {ticket.priority}
        {ticket.estimate != null ? ` · ${ticket.estimate} pts` : ""}
      </p>
    </div>
  );
}

function Column({
  id,
  name,
  colour,
  tickets,
  selectedId,
  onSelect,
}: {
  id: string;
  name: string;
  colour: string;
  tickets: TicketWithStatus[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <Card className="p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: colour }} />
        {name}
        <span className="text-muted">({tickets.length})</span>
      </h3>
      <div ref={setNodeRef} className="mt-3 min-h-16 space-y-2">
        {tickets.map((t) => (
          <TicketCard
            key={t.id}
            ticket={t}
            selected={t.id === selectedId}
            onSelect={() => onSelect(t.id)}
          />
        ))}
      </div>
    </Card>
  );
}

/**
 * Sprint board — columns come from the board (custom workflows), not a
 * fixed status list. Drag-to-move PATCHes /tickets/:id/status with the
 * target column id; the API writes status history (who/when/from/to).
 * Unplaced tickets (no column yet) sit in their own non-droppable column.
 * Clicking a ticket opens its detail panel below the board.
 */
export function TicketBoardPage() {
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedBoardId, setSelectedBoardId] = useState("");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // Phase 2 realtime: joins the selected ticket's room + announces
  // presence; ticket events invalidate the board queries live.
  const { presence, typingUsers } = useRealtime(selectedTicketId ?? undefined);

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
    retry: false,
  });
  const boardsQuery = useQuery({
    queryKey: ["boards", selectedProjectId],
    queryFn: () => fetchBoards(selectedProjectId || undefined),
    retry: false,
  });
  const ticketsQuery = useQuery({
    queryKey: ["tickets", selectedProjectId],
    queryFn: () => fetchTickets(selectedProjectId || undefined),
    retry: false,
  });
  const summaryQuery = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: fetchDashboardSummary,
    retry: false,
  });

  const projects = projectsQuery.data ?? [];
  const boards = boardsQuery.data ?? [];
  const board: BoardWithColumns | undefined = boards.find((b) => b.id === selectedBoardId);

  // Default to the first project, then its default board.
  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) setSelectedProjectId(projects[0].id);
  }, [projects, selectedProjectId]);
  useEffect(() => {
    if (selectedProjectId && boards.length > 0 && !boards.some((b) => b.id === selectedBoardId)) {
      setSelectedBoardId(boards[0].id);
    }
  }, [boards, selectedBoardId, selectedProjectId]);

  const form = useForm({
    resolver: zodResolver(createTicketSchema),
    defaultValues: {
      projectId: "",
      boardId: "",
      statusId: "",
      title: "",
      priority: "MEDIUM" as const,
      estimate: undefined,
    },
  });
  const watchedStatusId = form.watch("statusId");

  // Keep the hidden form fields in sync with the pickers.
  useEffect(() => {
    if (selectedProjectId) form.setValue("projectId", selectedProjectId);
    if (selectedBoardId) form.setValue("boardId", selectedBoardId);
    const firstColumn = board?.columns[0];
    if (firstColumn && !watchedStatusId) form.setValue("statusId", firstColumn.id);
  }, [selectedProjectId, selectedBoardId, board, watchedStatusId, form]);

  const tickets = ticketsQuery.data ?? [];
  const boardTickets = tickets.filter((t) => !board || t.boardId === board.id);
  const unplaced = boardTickets.filter((t) => !t.statusId);
  const selectedTicket = boardTickets.find((t) => t.id === selectedTicketId) ?? null;
  const memberName = (userId: string | null | undefined) =>
    summaryQuery.data?.members.find((m) => m.userId === userId)?.name ?? null;

  const create = useMutation({
    mutationFn: createTicket,
    onSuccess: () => {
      form.reset({
        projectId: selectedProjectId,
        boardId: selectedBoardId,
        statusId: form.getValues("statusId"),
        title: "",
        priority: "MEDIUM",
        estimate: undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["tickets", selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "summary"] });
    },
  });
  const move = useMutation({
    mutationFn: ({ ticketId, statusId }: { ticketId: string; statusId: string }) =>
      moveTicketToColumn(ticketId, statusId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets", selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "summary"] });
    },
  });

  const onDragEnd = (event: DragEndEvent) => {
    const columnId = event.over?.id;
    if (!columnId || typeof columnId !== "string" || columnId === "unplaced") return;
    const ticketId = String(event.active.id);
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket || ticket.statusId === columnId) return;
    move.mutate({ ticketId, statusId: columnId });
  };

  const loading = projectsQuery.isPending || boardsQuery.isPending || ticketsQuery.isPending;
  const loadError =
    projectsQuery.isError || boardsQuery.isError || ticketsQuery.isError;

  return (
    <div className="flex min-h-full flex-col">
      <TopBar title="Sprints" />
      <main className="space-y-4 p-6">
        <Card className="flex flex-wrap items-end gap-3 p-5">
          <Field label="Project" className="w-56">
            <Select
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                setSelectedBoardId("");
                setSelectedTicketId(null);
              }}
              aria-label="Project"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Board" className="w-56">
            <Select
              value={selectedBoardId}
              onChange={(e) => {
                setSelectedBoardId(e.target.value);
                setSelectedTicketId(null);
              }}
              aria-label="Board"
            >
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.isDefault ? " (default)" : ""}
                </option>
              ))}
            </Select>
          </Field>
          <span className="ml-auto text-xs text-muted">
            <Link to="/projects" className="font-medium text-forest hover:underline">
              Manage projects
            </Link>
          </span>
        </Card>

        <Card className="p-5">
          <form
            onSubmit={form.handleSubmit((data) => {
              create.mutate({
                projectId: data.projectId,
                boardId: data.boardId || undefined,
                statusId: data.statusId || undefined,
                title: data.title,
                priority: data.priority,
                estimate: data.estimate,
              });
            })}
            className="flex flex-wrap items-end gap-3"
          >
            <Field label="New ticket" className="min-w-64 flex-1">
              <Input
                {...form.register("title")}
                placeholder="New ticket title"
                className="w-full"
              />
            </Field>
            <Field label="Status" className="w-40">
              <Select
                value={watchedStatusId ?? ""}
                onChange={(e) => form.setValue("statusId", e.target.value)}
                aria-label="Status"
              >
                {(board?.columns ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Priority" className="w-32">
              <Select {...form.register("priority")}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </Select>
            </Field>
            <Field label="Estimate (pts)" className="w-24">
              <Input
                {...form.register("estimate", {
                  setValueAs: (v) => (v === "" ? undefined : Number(v)),
                })}
                type="number"
                min={0}
                max={100}
                placeholder="—"
                className="w-full"
              />
            </Field>
            <button
              type="submit"
              disabled={create.isPending || !selectedProjectId || !board}
              className="rounded-lg bg-forest px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {create.isPending ? "Adding…" : "Add ticket"}
            </button>
          </form>
          {form.formState.errors.title ? (
            <p className="mt-2 text-sm text-red-700">A title is required.</p>
          ) : null}
          {form.formState.errors.projectId ? (
            <p className="mt-2 text-sm text-red-700">Pick a project first.</p>
          ) : null}
          {create.isError ? (
            <p className="mt-2 text-sm text-red-700">
              Couldn't create that ticket — {create.error?.message ?? "the API refused it"}.
            </p>
          ) : null}
        </Card>

        {loading ? (
          <Card className="p-6 text-sm text-muted">Loading tickets…</Card>
        ) : loadError || projects.length === 0 ? (
          <Card className="p-6 text-sm text-muted">
            {projects.length === 0 && !loadError ? (
              <>
                No projects yet —{" "}
                <Link to="/projects" className="font-medium text-forest hover:underline">
                  create a project
                </Link>{" "}
                and its default board appears here.
              </>
            ) : (
              "The tickets API isn't reachable yet — start the API and sign in."
            )}
          </Card>
        ) : !board ? (
          <Card className="p-6 text-sm text-muted">
            This project has no board yet — boards are created automatically with every project.
          </Card>
        ) : (
          <>
            <DndContext onDragEnd={onDragEnd}>
              <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
                {board.columns.map((c) => (
                  <Column
                    key={c.id}
                    id={c.id}
                    name={c.name}
                    colour={c.colour}
                    tickets={boardTickets.filter((t) => t.statusId === c.id)}
                    selectedId={selectedTicketId}
                    onSelect={setSelectedTicketId}
                  />
                ))}
                {unplaced.length > 0 && (
                  <Column
                    id="unplaced"
                    name="Unplaced"
                    colour="#94A3B8"
                    tickets={unplaced}
                    selectedId={selectedTicketId}
                    onSelect={setSelectedTicketId}
                  />
                )}
              </div>
            </DndContext>
            {move.isError && (
              <Card className="p-4 text-sm text-red-700">
                Couldn't move that ticket — the API rejected the move.
              </Card>
            )}

            {selectedTicket ? (
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-muted">{selectedTicket.key}</p>
                    <h3 className="mt-0.5 text-sm font-semibold text-ink">
                      {selectedTicket.title}
                    </h3>
                    {selectedTicket.description ? (
                      <p className="mt-2 text-sm text-muted">{selectedTicket.description}</p>
                    ) : null}
                    {presence.length > 0 ? (
                      <p className="mt-2 text-xs text-muted">
                        Viewing now: {presence.map((p) => p.name ?? p.userId).join(", ")}
                      </p>
                    ) : null}
                    {typingUsers.length > 0 ? (
                      <p className="mt-1 text-xs text-muted">
                        {typingUsers.map((p) => p.name ?? p.userId).join(", ")} typing…
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedTicketId(null)}
                    className="rounded-full border border-line bg-panel px-3 py-1 text-xs font-medium text-ink hover:bg-canvas"
                  >
                    Close
                  </button>
                </div>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-xs text-muted">Priority</dt>
                    <dd className="mt-0.5 font-medium">{selectedTicket.priority}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Estimate</dt>
                    <dd className="mt-0.5 font-medium">
                      {selectedTicket.estimate != null
                        ? `${selectedTicket.estimate} pts`
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Assignee</dt>
                    <dd className="mt-0.5 font-medium">
                      {memberName(selectedTicket.assigneeId) ??
                        selectedTicket.assigneeId ??
                        "Unassigned"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Due date</dt>
                    <dd className="mt-0.5 font-medium">
                      {selectedTicket.dueDate
                        ? new Date(selectedTicket.dueDate).toLocaleDateString()
                        : "—"}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4">
                  <p className="text-xs font-medium text-muted">Move to status</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {board.columns.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        disabled={move.isPending || selectedTicket.statusId === c.id}
                        onClick={() => move.mutate({ ticketId: selectedTicket.id, statusId: c.id })}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
                          selectedTicket.statusId === c.id
                            ? "border-forest bg-forest text-white"
                            : "border-line bg-panel text-ink hover:bg-canvas"
                        } disabled:opacity-50`}
                      >
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ background: c.colour }}
                        />
                        {c.name}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    Current status:{" "}
                    <span className="font-medium text-ink">
                      {selectedTicket.status?.name ?? "Unplaced"}
                    </span>
                  </p>
                </div>
                <TimeEntriesPanel ticketId={selectedTicket.id} />
              </Card>
            ) : null}

            <DailyUpdateComposer tickets={boardTickets} />
          </>
        )}
      </main>
    </div>
  );
}
