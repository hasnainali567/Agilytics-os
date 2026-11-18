import type { WidgetProps } from "../types";
import { EmptyScope, hasScope } from "./EmptyScope";

/**
 * AI brief — daily brief / risk list. Phase 3 data; the widget ships
 * in Phase 1 as the brief slot only (FRONTEND.md §1B). It renders no
 * generated content and no placeholder numbers.
 */
export function AiBriefWidget({ config, onClearScope }: WidgetProps) {
  if (hasScope(config)) return <EmptyScope onClearScope={onClearScope} />;
  return (
    <div className="flex h-full flex-col items-start justify-center gap-2 p-5 text-sm">
      <span className="inline-flex rounded-full bg-forest px-2.5 py-0.5 text-xs font-medium text-white">
        AI BRIEF · PHASE 3
      </span>
      <p className="font-semibold text-ink">Your daily brief will live here</p>
      <p className="text-muted">
        Once the AI agent lands, this slot shows the morning brief and the risk list — risks,
        blockers and stale work, explained in plain words.
      </p>
    </div>
  );
}
