import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createDailyUpdateSchema } from "@agilytics/shared";
import { Card, Field, Input, Select, Textarea } from "./ui";
import { postDailyUpdate } from "../lib/api";

/**
 * Daily Update composer — Kanban main design: white 18px card,
 * labelled fields on the shared Input/Select/Textarea primitives,
 * vivid purple #6C5CE7 submit button. One update per member per
 * ticket per day. Posts to POST /tickets/:id/daily-updates (upsert
 * for today) and refreshes the dashboard summary + Today feed.
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
      <h3 className="text-sm font-semibold text-ink">Daily update — today</h3>
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
        <Field label="Ticket">
          <Select
            value={selected}
            onChange={(e) => setTicketId(e.target.value)}
            aria-label="Ticket"
          >
            {tickets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="What did you do today?">
          <Textarea
            {...form.register("doneToday")}
            placeholder="What did you do today?"
            rows={2}
            className="w-full"
          />
        </Field>
        <Field label="What is next?">
          <Textarea
            {...form.register("next")}
            placeholder="What is next?"
            rows={1}
            className="w-full"
          />
        </Field>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Progress %" className="w-32">
            <Input
              {...form.register("progressPercent", {
                setValueAs: (v) => (v === "" ? undefined : Number(v)),
              })}
              type="number"
              min={0}
              max={100}
              placeholder="Progress %"
              className="w-full"
            />
          </Field>
          <Field label="Minutes spent" className="w-36">
            <Input
              {...form.register("timeSpentMin", {
                setValueAs: (v) => (v === "" ? undefined : Number(v)),
              })}
              type="number"
              min={0}
              placeholder="Minutes spent"
              className="w-full"
            />
          </Field>
          <Field label="Health" className="w-36">
            <Select {...form.register("health")} aria-label="Health">
              <option value="ON_TRACK">On track</option>
              <option value="AT_RISK">At risk</option>
              <option value="BLOCKED">Blocked</option>
            </Select>
          </Field>
          <label className="flex items-center gap-2 pb-2.5 text-sm text-ink">
            <input type="checkbox" {...form.register("hasBlocker")} />
            Blocked?
          </label>
        </div>
        <Field label="Blockers (if any)">
          <Textarea
            {...form.register("blockers")}
            placeholder="Blockers (if any)"
            rows={1}
            className="w-full"
          />
        </Field>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={save.isPending}
            className="rounded-[10px] bg-[#6C5CE7] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#5B4BD6] disabled:opacity-50"
          >
            {save.isPending ? "Saving…" : "Save today's update"}
          </button>
          {saved && <span className="text-sm text-done-strong">Saved for today.</span>}
          {save.isError && <span className="text-sm text-risk">Couldn't save — try again.</span>}
        </div>
      </form>
    </Card>
  );
}
