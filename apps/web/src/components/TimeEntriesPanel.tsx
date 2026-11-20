import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Trash2 } from "lucide-react";
import { Field, Input } from "./ui";
import { createTimeEntry, deleteTimeEntry, fetchTimeEntries } from "../lib/api";

/** Kanban main design — vivid purple primary on the #E9EEF5 page.
 *  Literal hex here matches the locked Kanban tokens in index.css. */
const PURPLE = "#6C5CE7";

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

function initialsFor(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Time tracking on a ticket — entries list + total + add-entry form.
 * Uses the shared Input/Field primitives. Entries come from
 * GET /tickets/:id/time-entries (which already includes the
 * DailyUpdate.timeSpentMin sync — see TimeEntriesService).
 */
export function TimeEntriesPanel({ ticketId }: { ticketId: string }) {
  const queryClient = useQueryClient();
  const [minutes, setMinutes] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["time-entries", ticketId],
    queryFn: () => fetchTimeEntries(ticketId),
    retry: false,
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["time-entries", ticketId] });
    void queryClient.invalidateQueries({ queryKey: ["reporting", "time"] });
  };

  const create = useMutation({
    mutationFn: () => createTimeEntry(ticketId, { minutes: Number(minutes), date, note: note || undefined }),
    onSuccess: () => {
      setMinutes("");
      setNote("");
      setFormError(null);
      invalidate();
    },
    onError: (err) => setFormError(err.message),
  });
  const remove = useMutation({
    mutationFn: (entryId: string) => deleteTimeEntry(ticketId, entryId),
    onSettled: invalidate,
  });

  const entries = query.data?.entries ?? [];
  const totalMinutes = query.data?.totalMinutes ?? 0;

  return (
    <div className="mt-5 border-t border-[#E5E7EB] pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
          <Clock size={15} style={{ color: PURPLE }} />
          Time tracked
        </h4>
        <p className="text-sm text-[#6B7280]">
          Total{" "}
          <span className="rounded-full bg-[#F3F0FF] px-2.5 py-0.5 font-semibold tabular-nums text-[#5A4BD1]">
            {formatMinutes(totalMinutes)}
          </span>
        </p>
      </div>

      {query.isPending ? (
        <p className="mt-3 text-sm text-[#6B7280]">Loading time entries…</p>
      ) : query.isError ? (
        <p className="mt-3 text-sm text-[#6B7280]">Couldn't load time entries.</p>
      ) : entries.length === 0 ? (
        <p className="mt-3 text-sm text-[#6B7280]">No time logged yet — add the first entry below.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {entries.map((e) => {
            const name = e.member?.name ?? "Someone";
            return (
              <li
                key={e.id}
                className="flex items-center gap-2.5 rounded-[12px] bg-[#F2F3F7] px-3 py-2"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EDE9FE] text-[11px] font-bold text-[#6D28D9]">
                  {initialsFor(name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-semibold tabular-nums text-[#111827]">
                    {formatMinutes(e.minutes)}
                  </span>{" "}
                  <span className="text-[#6B7280]">
                    {new Date(e.date).toLocaleDateString()} · {name}
                    {e.note ? ` · ${e.note}` : ""}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => remove.mutate(e.id)}
                  disabled={remove.isPending}
                  title="Remove entry"
                  aria-label="Remove time entry"
                  className="shrink-0 rounded-full p-1.5 text-[#6B7280] hover:bg-[#FEE2E2] hover:text-[#EF4444] disabled:opacity-50"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form
        className="mt-3 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const n = Number(minutes);
          if (!Number.isInteger(n) || n < 1 || n > 1440) {
            setFormError("Minutes must be a whole number between 1 and 1440.");
            return;
          }
          create.mutate();
        }}
      >
        <Field label="Minutes" className="w-24">
          <Input
            type="number"
            min={1}
            max={1440}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="60"
            className="w-full"
            aria-label="Minutes"
          />
        </Field>
        <Field label="Date" className="w-40">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full"
            aria-label="Date"
          />
        </Field>
        <Field label="Note (optional)" className="min-w-48 flex-1">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What was this time for?"
            className="w-full"
            aria-label="Note"
          />
        </Field>
        <button
          type="submit"
          disabled={create.isPending}
          className="rounded-[10px] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          style={{ background: PURPLE }}
        >
          {create.isPending ? "Adding…" : "Log time"}
        </button>
      </form>
      {formError ? <p className="mt-2 text-sm text-[#B91C1C]">{formError}</p> : null}
      {create.isError && !formError ? (
        <p className="mt-2 text-sm text-[#B91C1C]">Couldn't log that time — the API refused it.</p>
      ) : null}
    </div>
  );
}
