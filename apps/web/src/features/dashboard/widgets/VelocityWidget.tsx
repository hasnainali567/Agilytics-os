import type { WidgetProps } from "../types";
import { EmptyScope, EmptyState, hasScope } from "./EmptyScope";

const WEEKS: Record<string, number> = { "4w": 4, "6w": 6, "12w": 12 };

/** Points entering DONE per week, as progress bars (completed vs planned). */
export function VelocityWidget({ summary, config, onClearScope }: WidgetProps) {
  if (hasScope(config)) return <EmptyScope onClearScope={onClearScope} />;
  const weeks = summary.velocity.slice(-(WEEKS[config.timeRange ?? "6w"] ?? 6));
  if (weeks.length === 0) {
    return (
      <EmptyState>
        No tickets have entered Done yet — velocity appears once work completes.
      </EmptyState>
    );
  }
  return (
    <div className="space-y-3.5 p-5" role="list" aria-label="Velocity by week">
      {weeks.map((point) => {
        const pct =
          point.planned > 0
            ? Math.min(100, Math.round((point.completed / point.planned) * 100))
            : 0;
        return (
          <div key={point.week} role="listitem">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium text-ink">{point.week}</span>
              <span className="tabular-nums text-muted">
                {`${point.completed} / ${point.planned} pts · ${pct}%`}
              </span>
            </div>
            <div
              className="mt-1.5 h-3 w-full rounded-full bg-track"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Week ${point.week}: ${point.completed} of ${point.planned} points done`}
            >
              <div className="h-full rounded-full bg-lime-deep" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
