import { useEffect, useState } from "react";
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createTicketSchema } from "@agilytics/shared";
import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  Clock,
  KanbanSquare,
  List,
  MessageSquare,
  Pencil,
  Plus,
  Send,
  SquareSplitHorizontal,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { TopBar } from "../components/layout";
import { DailyUpdateComposer } from "../components/DailyUpdateComposer";
import { TimeEntriesPanel } from "../components/TimeEntriesPanel";
import { Card, Field, Input, Select, Textarea } from "../components/ui";
import { useRealtime } from "../lib/useRealtime";
import { getCurrentUser } from "../lib/authFetch";
import {
  createComment,
  createTicket,
  deleteComment,
  fetchBoards,
  fetchComments,
  fetchDashboardSummary,
  fetchProjects,
  fetchTickets,
  moveTicketToColumn,
  type BoardWithColumns,
  type TicketWithStatus,
} from "../lib/api";

type BoardView = "board" | "list" | "split";

/** Kanban main design — vivid purple primary, green for new/done,
 *  soft pastel tag tints. Literal hex here matches the locked Kanban
 *  tokens in index.css. */
const PURPLE = "#6C5CE7";
const PURPLE_DARK = "#5A4BD1";
const PURPLE_TINT = "#F3F0FF";
const PAGE_BG = "#E9EEF5";

const PRIORITY_PILL: Record<string, string> = {
  LOW: "bg-[#F2F3F7] text-[#6B7280]",
  MEDIUM: "bg-[#DBEAFE] text-[#1D4ED8]",
  HIGH: "bg-[#FEF3C7] text-[#92400E]",
  URGENT: "bg-[#FEE2E2] text-[#B91C1C]",
};

/** Pastel avatar fills — stable per name so a person keeps one colour. */
const AVATAR_COLORS = [
  { bg: "#FCE7F3", text: "#BE185D" },
  { bg: "#DBEAFE", text: "#1D4ED8" },
  { bg: "#DCFCE7", text: "#15803D" },
  { bg: "#EDE9FE", text: "#6D28D9" },
  { bg: "#FEF3C7", text: "#92400E" },
  { bg: "#CCFBF1", text: "#0F766E" },
];

function initialsFor(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function Avatar({ name, size = "h-7 w-7 text-[11px]" }: { name: string; size?: string }) {
  const hash = [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const colour = AVATAR_COLORS[hash % AVATAR_COLORS.length];
  return (
    <span
      title={name}
      style={{ background: colour.bg, color: colour.text }}
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ${size}`}
    >
      {initialsFor(name)}
    </span>
  );
}

function CommentsSection({
  ticketId,
  memberName,
}: {
  ticketId: string;
  memberName: (userId: string | null | undefined) => string | null;
}) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const currentUserId = getCurrentUser()?.userId ?? null;

  const query = useQuery({
    queryKey: ["comments", ticketId],
    queryFn: () => fetchComments(ticketId),
    retry: false,
  });

  const add = useMutation({
    mutationFn: (text: string) => createComment(ticketId, text),
    onSuccess: () => {
      setBody("");
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ["comments", ticketId] });
    },
    onError: (err) => setFormError(err.message),
  });
  const remove = useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["comments", ticketId] });
    },
  });

  const comments = query.data ?? [];

  return (
    <div className="mt-5 border-t border-[#E5E7EB] pt-4">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
        <MessageSquare size={15} style={{ color: PURPLE }} />
        Comments
        {comments.length > 0 ? (
          <span className="rounded-full bg-[#F2F3F7] px-2 py-0.5 text-[11px] font-semibold text-[#6B7280]">
            {comments.length}
          </span>
        ) : null}
      </h4>

      {query.isPending ? (
        <p className="mt-3 text-sm text-[#6B7280]">Loading comments…</p>
      ) : query.isError ? (
        <p className="mt-3 text-sm text-[#6B7280]">Couldn't load comments.</p>
      ) : comments.length === 0 ? (
        <p className="mt-3 text-sm text-[#6B7280]">
          No comments yet — start the discussion below.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {comments.map((c) => {
            const author = memberName(c.authorId) ?? "Someone";
            const mine = currentUserId != null && c.authorId === currentUserId;
            return (
              <li key={c.id} className="flex items-start gap-2.5">
                <Avatar name={author} size="h-7 w-7 text-[11px]" />
                <div className="min-w-0 flex-1 rounded-[12px] bg-[#F2F3F7] px-3 py-2">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
                    <span className="font-semibold text-[#111827]">{author}</span>
                    <span className="text-[#6B7280]">
                      {new Date(c.createdAt).toLocaleString()}
                    </span>
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-[#111827]">
                    {c.body}
                  </p>
                </div>
                {mine ? (
                  <button
                    type="button"
                    onClick={() => remove.mutate(c.id)}
                    disabled={remove.isPending}
                    title="Delete comment"
                    aria-label="Delete comment"
                    className="mt-1 rounded-full p-1.5 text-[#6B7280] hover:bg-[#FEE2E2] hover:text-[#EF4444] disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <form
        className="mt-3 flex items-start gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const text = body.trim();
          if (!text) {
            setFormError("Write a comment first.");
            return;
          }
          add.mutate(text);
        }}
      >
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a comment…"
          rows={2}
          aria-label="Write a comment"
          className="min-w-0 flex-1 resize-none"
        />
        <button
          type="submit"
          disabled={add.isPending}
          aria-label="Post comment"
          className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-white transition-colors hover:opacity-90 disabled:opacity-50"
          style={{ background: PURPLE }}
        >
          <Send size={16} />
        </button>
      </form>
      {formError ? <p className="mt-2 text-sm text-[#B91C1C]">{formError}</p> : null}
      {add.isError && !formError ? (
        <p className="mt-2 text-sm text-[#B91C1C]">
          Couldn't post that comment — the API refused it.
        </p>
      ) : null}
    </div>
  );
}

function TicketCard({
  ticket,
  selected,
  assigneeName,
  commentCount,
  onSelect,
}: {
  ticket: TicketWithStatus;
  selected: boolean;
  assigneeName: string | null;
  commentCount: number | null;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: ticket.id,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  const overdue =
    ticket.dueDate != null && new Date(ticket.dueDate).getTime() < Date.now();
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onSelect}
      className={`cursor-grab rounded-[18px] border bg-white p-4 text-sm shadow-[0_1px_3px_rgba(17,24,39,0.06)] transition-shadow hover:shadow-[0_4px_14px_rgba(17,24,39,0.10)] active:cursor-grabbing ${
        selected ? "border-[#6C5CE7] ring-2 ring-[#6C5CE7]/25" : "border-[#E5E7EB]"
      } ${isDragging ? "opacity-70 shadow-[0_10px_24px_rgba(17,24,39,0.16)]" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
            PRIORITY_PILL[ticket.priority] ?? "bg-[#F2F3F7] text-[#6B7280]"
          }`}
        >
          {ticket.priority}
        </span>
        <span className="rounded-full bg-[#F2F3F7] px-2.5 py-0.5 text-[11px] font-medium text-[#6B7280]">
          {ticket.key}
        </span>
        {ticket.status ? (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium text-[#111827]"
            style={{ background: `${ticket.status.colour}1F` }}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: ticket.status.colour }}
            />
            {ticket.status.name}
          </span>
        ) : null}
      </div>
      <p className="mt-2.5 font-semibold leading-snug text-[#111827]">{ticket.title}</p>
      {ticket.description ? (
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#6B7280]">
          {ticket.description}
        </p>
      ) : null}
      <div className="mt-3 flex items-center gap-2 border-t border-[#E5E7EB] pt-3">
        {assigneeName ? (
          <>
            <Avatar name={assigneeName} />
            <span className="truncate text-xs font-medium text-[#111827]">{assigneeName}</span>
          </>
        ) : (
          <span className="text-xs text-[#6B7280]">Unassigned</span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-3 text-xs text-[#6B7280]">
          {commentCount != null && commentCount > 0 ? (
            <span className="inline-flex items-center gap-1">
              <MessageSquare size={13} />
              {commentCount}
            </span>
          ) : null}
          {ticket.estimate != null ? (
            <span className="inline-flex items-center gap-1 font-medium text-[#111827]">
              <Clock size={13} />
              {ticket.estimate} pts
            </span>
          ) : null}
          {ticket.dueDate ? (
            <span
              className={`inline-flex items-center gap-1 ${overdue ? "font-semibold text-[#EF4444]" : ""}`}
            >
              <CalendarDays size={13} />
              {new Date(ticket.dueDate).toLocaleDateString()}
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
}

function Column({
  id,
  name,
  colour,
  tickets,
  selectedId,
  assigneeNameFor,
  onSelect,
}: {
  id: string;
  name: string;
  colour: string;
  tickets: TicketWithStatus[];
  selectedId: string | null;
  assigneeNameFor: (userId: string | null | undefined) => string | null;
  onSelect: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  // Hours = sum of estimates in this column; shown only when estimates exist.
  // No separate hours data exists in the API, so no hours are invented.
  const hours = tickets.reduce((sum, t) => sum + (t.estimate ?? 0), 0);
  return (
    <section className="w-[300px] shrink-0">
      <div className="flex items-center gap-2">
        <span
          className="rounded-full px-3 py-1 text-xs font-semibold text-white shadow-sm"
          style={{ background: colour }}
        >
          {name}
        </span>
        <span className="text-xs font-medium text-[#6B7280]">
          {tickets.length} Task{tickets.length === 1 ? "" : "s"}
        </span>
        {hours > 0 ? (
          <span className="text-xs text-[#6B7280]">· {hours} Hours</span>
        ) : null}
      </div>
      <div
        ref={setNodeRef}
        className={`mt-3 min-h-24 space-y-3 rounded-[18px] p-1 transition-colors ${
          isOver ? "bg-[#6C5CE7]/10 ring-2 ring-[#6C5CE7]/40" : ""
        }`}
      >
        {tickets.map((t) => (
          <TicketCard
            key={t.id}
            ticket={t}
            selected={t.id === selectedId}
            assigneeName={assigneeNameFor(t.assigneeId)}
            commentCount={null}
            onSelect={() => onSelect(t.id)}
          />
        ))}
        {tickets.length === 0 ? (
          <p className="rounded-[12px] border border-dashed border-[#E5E7EB] px-3 py-4 text-center text-xs text-[#6B7280]">
            Drop tickets here
          </p>
        ) : null}
      </div>
    </section>
  );
}

function TicketDetailPanel({
  ticket,
  board,
  presence,
  typingUsers,
  memberName,
  movePending,
  onMove,
  onClose,
}: {
  ticket: TicketWithStatus;
  board: BoardWithColumns;
  presence: { name?: string | null; userId: string }[];
  typingUsers: { name?: string | null; userId: string }[];
  memberName: (userId: string | null | undefined) => string | null;
  movePending: boolean;
  onMove: (statusId: string) => void;
  onClose: () => void;
}) {
  const assignee = memberName(ticket.assigneeId);
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#6B7280]">
            <span>{ticket.key}</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                PRIORITY_PILL[ticket.priority] ?? "bg-[#F2F3F7] text-[#6B7280]"
              }`}
            >
              {ticket.priority}
            </span>
            {ticket.status ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium text-white"
                style={{ background: ticket.status.colour }}
              >
                {ticket.status.name}
              </span>
            ) : (
              <span className="rounded-full bg-[#F2F3F7] px-2.5 py-0.5 text-[11px] font-medium text-[#6B7280]">
                Unplaced
              </span>
            )}
          </p>
          <h3 className="mt-1.5 text-lg font-bold leading-snug text-[#111827]">
            {ticket.title}
          </h3>
          {ticket.description ? (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#6B7280]">
              {ticket.description}
            </p>
          ) : null}
          {presence.length > 0 ? (
            <p className="mt-2 text-xs text-[#6B7280]">
              Viewing now: {presence.map((p) => p.name ?? p.userId).join(", ")}
            </p>
          ) : null}
          {typingUsers.length > 0 ? (
            <p className="mt-1 text-xs text-[#6B7280]">
              {typingUsers.map((p) => p.name ?? p.userId).join(", ")} typing…
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close ticket details"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#6B7280] hover:bg-[#F2F3F7] hover:text-[#111827]"
        >
          <X size={16} />
        </button>
      </div>

      <dl className="mt-4 grid gap-3 border-t border-[#E5E7EB] pt-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs text-[#6B7280]">Priority</dt>
          <dd className="mt-0.5 font-medium text-[#111827]">{ticket.priority}</dd>
        </div>
        <div>
          <dt className="text-xs text-[#6B7280]">Estimate</dt>
          <dd className="mt-0.5 font-medium text-[#111827]">
            {ticket.estimate != null ? `${ticket.estimate} pts` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[#6B7280]">Assignee</dt>
          <dd className="mt-0.5 flex items-center gap-2 font-medium text-[#111827]">
            {assignee ? (
              <>
                <Avatar name={assignee} size="h-6 w-6 text-[10px]" />
                {assignee}
              </>
            ) : (
              "Unassigned"
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[#6B7280]">Due date</dt>
          <dd className="mt-0.5 font-medium text-[#111827]">
            {ticket.dueDate ? new Date(ticket.dueDate).toLocaleDateString() : "—"}
          </dd>
        </div>
      </dl>

      <div className="mt-4">
        <p className="text-xs font-medium text-[#6B7280]">Move to status</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {board.columns.map((c) => {
            const current = ticket.statusId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                disabled={movePending || current}
                onClick={() => onMove(c.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                  current ? "border-transparent text-white" : "border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F2F3F7]"
                }`}
                style={current ? { background: PURPLE } : undefined}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: current ? "#FFFFFF" : c.colour }}
                />
                {c.name}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-[#6B7280]">
          Current status:{" "}
          <span className="font-medium text-[#111827]">{ticket.status?.name ?? "Unplaced"}</span>
        </p>
      </div>

      <CommentsSection ticketId={ticket.id} memberName={memberName} />
      <TimeEntriesPanel ticketId={ticket.id} />
    </Card>
  );
}

/**
 * Sprint board — columns come from the board (custom workflows), not a
 * fixed status list. Drag-to-move PATCHes /tickets/:id/status with the
 * target column id; the API writes status history (who/when/from/to).
 * Unplaced tickets (no column yet) sit in their own non-droppable column.
 * Clicking a ticket opens its detail panel below the board (or beside
 * it in split view). List and split are real alternate renderings of
 * the same tickets — list is a compact table, split puts the board
 * beside the detail panel.
 */
export function TicketBoardPage() {
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedBoardId, setSelectedBoardId] = useState("");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [view, setView] = useState<BoardView>("board");
  const [showCreateForm, setShowCreateForm] = useState(false);

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
  const project = projects.find((p) => p.id === selectedProjectId);
  const members = summaryQuery.data?.members ?? [];

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
      setShowCreateForm(false);
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

  const viewButton = (v: BoardView, label: string, Icon: typeof List) => {
    const active = view === v;
    return (
      <button
        key={v}
        type="button"
        onClick={() => setView(v)}
        title={label}
        aria-label={`${label} view`}
        aria-pressed={active}
        className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
          active ? "text-white" : "text-[#6B7280] hover:text-[#111827]"
        }`}
        style={active ? { background: PURPLE } : undefined}
      >
        <Icon size={16} strokeWidth={2} />
      </button>
    );
  };

  const detailPanel = selectedTicket && board ? (
    <TicketDetailPanel
      ticket={selectedTicket}
      board={board}
      presence={presence}
      typingUsers={typingUsers}
      memberName={memberName}
      movePending={move.isPending}
      onMove={(statusId) => move.mutate({ ticketId: selectedTicket.id, statusId })}
      onClose={() => setSelectedTicketId(null)}
    />
  ) : null;

  const kanban = board ? (
    <DndContext onDragEnd={onDragEnd}>
      <div className="flex items-start gap-4 overflow-x-auto pb-2">
        {board.columns.map((c) => (
          <Column
            key={c.id}
            id={c.id}
            name={c.name}
            colour={c.colour}
            tickets={boardTickets.filter((t) => t.statusId === c.id)}
            selectedId={selectedTicketId}
            assigneeNameFor={memberName}
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
            assigneeNameFor={memberName}
            onSelect={setSelectedTicketId}
          />
        )}
      </div>
    </DndContext>
  ) : null;

  const listView = (
    <Card className="divide-y divide-[#E5E7EB] overflow-hidden p-0">
      {boardTickets.length === 0 ? (
        <p className="p-5 text-sm text-[#6B7280]">No tickets on this board yet.</p>
      ) : (
        boardTickets.map((t) => {
          const assignee = memberName(t.assigneeId);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedTicketId(t.id)}
              className={`flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left text-sm hover:bg-[#F2F3F7] ${
                t.id === selectedTicketId ? "bg-[#F3F0FF]" : ""
              }`}
            >
              <span className="w-16 shrink-0 text-xs font-medium text-[#6B7280]">{t.key}</span>
              <span className="min-w-0 flex-1 truncate font-semibold text-[#111827]">{t.title}</span>
              {t.status ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium text-white" style={{ background: t.status.colour }}>
                  {t.status.name}
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-[#F2F3F7] px-2.5 py-1 text-[11px] font-medium text-[#6B7280]">
                  Unplaced
                </span>
              )}
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  PRIORITY_PILL[t.priority] ?? "bg-[#F2F3F7] text-[#6B7280]"
                }`}
              >
                {t.priority}
              </span>
              <span className="flex w-32 shrink-0 items-center gap-1.5 truncate text-xs text-[#6B7280]">
                {assignee ? (
                  <>
                    <Avatar name={assignee} size="h-6 w-6 text-[10px]" />
                    <span className="truncate">{assignee}</span>
                  </>
                ) : (
                  "Unassigned"
                )}
              </span>
              <span className="w-14 shrink-0 text-right text-xs text-[#6B7280]">
                {t.estimate != null ? `${t.estimate} pts` : "—"}
              </span>
              <span className="w-24 shrink-0 text-right text-xs text-[#6B7280]">
                {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}
              </span>
            </button>
          );
        })
      )}
    </Card>
  );

  return (
    <div className="flex min-h-full flex-col" style={{ background: PAGE_BG }}>
      <TopBar title="Boards" />
      <main className="space-y-4 p-6">
        {/* Project header — breadcrumb, title, team, view switcher, create. */}
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium text-[#6B7280]">
                <Link to="/projects" className="hover:text-[#111827] hover:underline">
                  Projects
                </Link>
                {project ? (
                  <>
                    {" / "}
                    <span className="text-[#111827]">{project.name}</span>
                  </>
                ) : null}
                {board ? (
                  <>
                    {" / "}
                    <span className="text-[#111827]">{board.name}</span>
                  </>
                ) : null}
              </p>
              <h2 className="mt-1 truncate text-xl font-bold text-[#111827] sm:text-2xl">
                {project?.name ?? "Board"}
              </h2>
              {project ? (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-[#6B7280]">
                  Created {new Date(project.createdAt).toLocaleDateString()}
                  <Link
                    to="/projects"
                    title="Edit project"
                    aria-label="Edit project"
                    className="inline-flex items-center text-[#6B7280] hover:text-[#111827]"
                  >
                    <Pencil size={13} />
                  </Link>
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {members.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-[#6B7280]">
                    All team members: {members.length}
                  </p>
                  <div className="mt-1.5 flex items-center">
                    {members.slice(0, 4).map((m, i) => (
                      <span key={m.userId} className={i === 0 ? "" : "-ml-2"}>
                        <span className="block rounded-full ring-2 ring-white">
                          <Avatar name={m.name} />
                        </span>
                      </span>
                    ))}
                    {members.length > 4 ? (
                      <span
                        className="-ml-2 flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-[#111827] ring-2 ring-white"
                        style={{ background: PURPLE_TINT, color: PURPLE_DARK }}
                      >
                        +{members.length - 4}
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <Link
                to="/members"
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-medium text-[#111827] hover:bg-[#F2F3F7]"
              >
                <UserPlus size={15} />
                Invite
              </Link>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-[#E5E7EB] pt-4">
            <Field label="Project" className="w-52">
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
            <Field label="Board" className="w-52">
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
            <span className="pb-2 text-xs text-[#6B7280]">
              <Link to="/projects" className="font-medium hover:underline" style={{ color: PURPLE }}>
                Manage projects
              </Link>
            </span>
            <div className="ml-auto flex items-center gap-2 pb-0.5">
              <div
                className="flex items-center gap-0.5 rounded-full border border-[#E5E7EB] bg-[#E9EEF5] p-1"
                role="group"
                aria-label="Board view"
              >
                {viewButton("list", "List", List)}
                {viewButton("board", "Board", KanbanSquare)}
                {viewButton("split", "Split", SquareSplitHorizontal)}
              </div>
              <button
                type="button"
                onClick={() => setShowCreateForm((v) => !v)}
                disabled={!selectedProjectId || !board}
                className="inline-flex items-center gap-1.5 rounded-[10px] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:opacity-90 disabled:opacity-50"
                style={{ background: PURPLE }}
              >
                <Plus size={16} />
                Create
              </button>
            </div>
          </div>
        </Card>

        {showCreateForm ? (
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
                  autoFocus
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
                className="rounded-[10px] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                style={{ background: PURPLE }}
              >
                {create.isPending ? "Adding…" : "Add ticket"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#111827] hover:bg-[#F2F3F7]"
              >
                Cancel
              </button>
            </form>
            {form.formState.errors.title ? (
              <p className="mt-2 text-sm text-[#B91C1C]">A title is required.</p>
            ) : null}
            {form.formState.errors.projectId ? (
              <p className="mt-2 text-sm text-[#B91C1C]">Pick a project first.</p>
            ) : null}
            {create.isError ? (
              <p className="mt-2 text-sm text-[#B91C1C]">
                Couldn't create that ticket — {create.error?.message ?? "the API refused it"}.
              </p>
            ) : null}
          </Card>
        ) : null}

        {loading ? (
          <Card className="p-6 text-sm text-[#6B7280]">Loading tickets…</Card>
        ) : loadError || projects.length === 0 ? (
          <Card className="p-6 text-sm text-[#6B7280]">
            {projects.length === 0 && !loadError ? (
              <>
                No projects yet —{" "}
                <Link to="/projects" className="font-medium hover:underline" style={{ color: PURPLE }}>
                  create a project
                </Link>{" "}
                and its default board appears here.
              </>
            ) : (
              "The tickets API isn't reachable yet — start the API and sign in."
            )}
          </Card>
        ) : !board ? (
          <Card className="p-6 text-sm text-[#6B7280]">
            This project has no board yet — boards are created automatically with every project.
          </Card>
        ) : (
          <>
            {view === "list" ? (
              listView
            ) : view === "split" ? (
              <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
                {kanban}
                {detailPanel ?? (
                  <Card className="p-5 text-sm text-[#6B7280]">
                    Select a ticket to see its details here.
                  </Card>
                )}
              </div>
            ) : (
              kanban
            )}
            {move.isError && (
              <Card className="p-4 text-sm text-[#B91C1C]">
                Couldn't move that ticket — the API rejected the move.
              </Card>
            )}

            {view !== "split" ? detailPanel : null}

            <DailyUpdateComposer tickets={boardTickets} />
          </>
        )}
      </main>
    </div>
  );
}
