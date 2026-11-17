import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createDailyUpdateSchema } from "@agilytics/shared";
import { Card } from "./ui";
import { postDailyUpdate } from "../lib/api";

/**
 * Daily Update composer — one update per member per ticket per day.
 * What was done, what is next, blockers, progress %, health, time spent.
 * Posts to POST /tickets/:id/daily-updates (upsert for today).
 */
export function DailyUpdateComposer({ tickets }: { tickets: { id: string; title: string }[] }) {
  const queryClient = useQueryClient();
  const [ticketId, setTicketId] = useState("");
  const [saved, setSaved] = useState(false);
  const form = useForm({ resolver: zodResolver(createDailyUpdateSchema) });
  const selected = ticketId || tickets[0]?.id || "";
  const save = useMutation({
    mutationFn: (data: {
      doneToday: string;
      next?: string;
      blockers?: string;
      hasBlocker?: boolean;
      progressPercent?: number;
      health?: "ON_TRACK" | "AT_RISK" | "BLOCKED";
      timeSpentMin?: number;
    }) => postDailyUpdate(selected, data),
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["dashboard", "summary"] });
      queryClient.invalidateQueries({ queryKey: ["today-feed"] });
    },
  });

  if (tickets.length === 0) return null;

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold">Daily update — today</h3>
      <p className="mt-1 text-xs text-muted">
        One update per ticket per day. This is what the Today feed, stale-ticket detection and
        blocker lists read — not comments.
      </p>
      <form
        onSubmit={form.handleSubmit((data) => {
          setSaved(false);
          save.mutate(data);
        })}
        className="mt-4 space-y-3"
      >
        <select
          value={selected}
          onChange={(e) => setTicketId(e.target.value)}
          className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none"
          aria-label="Ticket"
        >
          {tickets.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
        <textarea
          {...form.register("doneToday")}
          placeholder="What did you do today?"
          rows={2}
          className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none"
        />
        <textarea
          {...form.register("next")}
          placeholder="What is next?"
          rows={1}
          className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none"
        />
        <div className="flex gap-3">
          <input
            {...form.register("progressPercent", {
              setValueAs: (v) => (v === "" ? undefined : Number(v)),
            })}
            type="number"
            min={0}
            max={100}
            placeholder="Progress %"
            className="w-32 rounded-lg border border-line px-3 py-2 text-sm outline-none"
          />
          <input
            {...form.register("timeSpentMin", {
              setValueAs: (v) => (v === "" ? undefined : Number(v)),
            })}
            type="number"
            min={0}
            placeholder="Minutes spent"
            className="w-36 rounded-lg border border-line px-3 py-2 text-sm outline-none"
          />
          <select
            {...form.register("health")}
            className="rounded-lg border border-line px-3 py-2 text-sm outline-none"
            aria-label="Health"
          >
            <option value="ON_TRACK">On track</option>
            <option value="AT_RISK">At risk</option>
            <option value="BLOCKED">Blocked</option>
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...form.register("hasBlocker")} />
            Blocked?
          </label>
        </div>
        <textarea
          {...form.register("blockers")}
          placeholder="Blockers (if any)"
          rows={1}
          className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none"
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={save.isPending}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {save.isPending ? "Saving…" : "Save today's update"}
          </button>
          {saved && <span className="text-sm text-green-700">Saved for today.</span>}
          {save.isError && <span className="text-sm text-red-700">Couldn't save — try again.</span>}
        </div>
      </form>
    </Card>
  );
}
