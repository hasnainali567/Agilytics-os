import { DndContext, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createTicketSchema } from "@agilytics/shared";
import { TopBar } from "../components/layout";
import { DailyUpdateComposer } from "../components/DailyUpdateComposer";
import { Card } from "../components/ui";
import { apiUrl } from "../lib/query-client";
import { apiFetch } from "../lib/authFetch";
import { fetchBoards, moveTicketToColumn, type BoardWithColumns } from "../lib/api";

type TicketRow = { id: string; title: string; statusId: string | null; boardId: string | null };

function TicketCard({ ticket }: { ticket: TicketRow }) {
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
      className="rounded-lg border border-line bg-panel p-3 text-sm"
    >
      {ticket.title}
    </div>
  );
}

function Column({
  id,
  name,
  colour,
  tickets,
}: {
  id: string;
  name: string;
  colour: string;
  tickets: TicketRow[];
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
          <TicketCard key={t.id} ticket={t} />
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
 */
export function TicketBoardPage() {
  const queryClient = useQueryClient();
  const boardsQuery = useQuery({
    queryKey: ["boards"],
    queryFn: () => fetchBoards(),
    retry: false,
  });
  const { data, isPending, isError } = useQuery({
    queryKey: ["tickets"],
    queryFn: async () => {
      const res = await apiFetch(`${apiUrl}/tickets`);
      if (!res.ok) throw new Error(`Tickets API failed: ${res.status}`);
      return (await res.json()) as TicketRow[];
    },
    retry: false,
  });
  const form = useForm({ resolver: zodResolver(createTicketSchema) });
  const move = useMutation({
    mutationFn: ({ ticketId, statusId }: { ticketId: string; statusId: string }) =>
      moveTicketToColumn(ticketId, statusId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["tickets"] }),
  });
  const onDragEnd = (event: DragEndEvent) => {
    const columnId = event.over?.id;
    if (!columnId || typeof columnId !== "string" || columnId === "unplaced") return;
    const ticketId = String(event.active.id);
    const ticket = data?.find((t) => t.id === ticketId);
    if (!ticket || ticket.statusId === columnId) return;
    move.mutate({ ticketId, statusId: columnId });
  };

  const board: BoardWithColumns | undefined = boardsQuery.data?.[0];
  const boardTickets = (data ?? []).filter((t) => !board || t.boardId === board.id);
  const unplaced = boardTickets.filter((t) => !t.statusId);

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar title="Sprints" />
      <main className="space-y-4 p-6">
        <Card className="p-5">
          <form
            onSubmit={form.handleSubmit(() => {
              // TODO: POST /tickets with the validated values (needs a project picker first)
            })}
            className="flex gap-3"
          >
            <input
              {...form.register("title")}
              placeholder="New ticket title"
              className="flex-1 rounded-lg border border-line px-3 py-2 text-sm outline-none"
            />
            <button
              type="submit"
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white"
            >
              Add ticket
            </button>
          </form>
        </Card>
        {isPending || boardsQuery.isPending ? (
          <Card className="p-6 text-sm text-muted">Loading tickets…</Card>
        ) : isError || !data || boardsQuery.isError || !board ? (
          <Card className="p-6 text-sm text-muted">
            The tickets API isn't reachable yet — start the API and sign in. Boards are created
            automatically with every project (default template).
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
                  />
                ))}
                {unplaced.length > 0 && (
                  <Column id="unplaced" name="Unplaced" colour="#94A3B8" tickets={unplaced} />
                )}
              </div>
            </DndContext>
            {move.isError && (
              <Card className="p-4 text-sm text-red-700">
                Couldn't move that ticket — the API rejected the move.
              </Card>
            )}
            <DailyUpdateComposer tickets={boardTickets} />
          </>
        )}
      </main>
    </div>
  );
}
