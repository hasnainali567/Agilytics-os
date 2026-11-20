import type { Member } from "@agilytics/shared";
import type { WidgetProps } from "../types";
import { EmptyScope, EmptyState, hasScope } from "./EmptyScope";

/** Donut segment colours — Kanban palette: purple primary, ink, done, warn, purple tint, muted. */
const SEGMENT_COLORS = ["#6C5CE7", "#111827", "#22C55E", "#F59E0B", "#C4B5FD", "#94A3B8"];

/** Workload by member — donut of active tickets, with a legend. */
export function WorkloadWidget({ summary, config, onClearScope }: WidgetProps) {
  if (hasScope(config)) return <EmptyScope onClearScope={onClearScope} />;
  const members = summary.members.filter((m) => m.activeTickets > 0);
  const total = members.reduce((sum, m) => sum + m.activeTickets, 0);
  if (total === 0) {
    return (
      <EmptyState>
        No active tickets assigned right now — workload appears once work is assigned.
      </EmptyState>
    );
  }
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-5 p-5">
      <div
        className="relative h-32 w-32 shrink-0"
        role="img"
        aria-label={`${total} active tickets across ${members.length} members`}
      >
        <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
          <circle cx="64" cy="64" r={radius} fill="none" className="stroke-track" strokeWidth="16" />
          {members.map((m, i) => {
            const fraction = m.activeTickets / total;
            const dash = fraction * circumference;
            const el = (
              <circle
                key={m.id}
                cx="64"
                cy="64"
                r={radius}
                fill="none"
                stroke={SEGMENT_COLORS[i % SEGMENT_COLORS.length]}
                strokeWidth="16"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[28px] font-semibold leading-none tabular-nums text-ink">
            {total}
          </span>
          <span className="mt-1 text-[10px] font-medium uppercase tracking-wide text-muted">
            active
          </span>
        </div>
      </div>
      <ul className="min-w-36 flex-1 space-y-2 text-sm">
        {members.slice(0, 6).map((m, i) => (
          <li key={m.id} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
            />
            <span className="flex-1 truncate font-medium text-ink">{m.name}</span>
            <span className="tabular-nums text-muted">
              {m.activeTickets} ·{" "}
              <span
                className={
                  m.status === "OVERLOADED"
                    ? "font-medium text-red-600"
                    : m.status === "AT_RISK"
                      ? "font-medium text-amber-600"
                      : ""
                }
              >
                {statusLabel(m)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function statusLabel(m: Member): string {
  return m.status === "OVERLOADED" ? "overloaded" : m.status === "AT_RISK" ? "at risk" : "on track";
}
