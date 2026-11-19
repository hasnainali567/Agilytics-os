import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Field, Input } from "./ui";
import { createTimeEntry, deleteTimeEntry, fetchTimeEntries } from "../lib/api";

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
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
    <div className="mt-4 border-t border-line pt-4">
      <div className="flex items-baseline justify-between">
        <h4 className="text-sm font-semibold text-ink">Time tracked</h4>
        <p className="text-sm text-muted">
          Total <span className="font-semibold text-ink">{formatMinutes(totalMinutes)}</span>
        </p>
      </div>

      {query.isPending ? (
        <p className="mt-2 text-sm text-muted">Loading time entries…</p>
      ) : query.isError ? (
        <p className="mt-2 text-sm text-muted">Couldn't load time entries.</p>
      ) : entries.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No time logged yet — add the first entry below.</p>
      ) : (
        <ul className="mt-2 space-y-1.5 text-sm">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center gap-2">
              <span className="font-medium tabular-nums text-ink">{formatMinutes(e.minutes)}</span>
              <span className="text-muted">
                {new Date(e.date).toLocaleDateString()} · {e.member?.name ?? "Someone"}
                {e.note ? ` · ${e.note}` : ""}
              </span>
              <button
                type="button"
                onClick={() => remove.mutate(e.id)}
                disabled={remove.isPending}
                className="ml-auto rounded-full px-2 py-0.5 text-xs font-medium text-muted hover:bg-canvas hover:text-risk disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
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
          className="rounded-lg bg-forest px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {create.isPending ? "Adding…" : "Log time"}
        </button>
      </form>
      {formError ? <p className="mt-2 text-sm text-red-700">{formError}</p> : null}
      {create.isError && !formError ? (
        <p className="mt-2 text-sm text-red-700">Couldn't log that time — the API refused it.</p>
      ) : null}
    </div>
  );
}
