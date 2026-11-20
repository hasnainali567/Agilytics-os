import type { ReactNode } from "react";

/**
 * Card chrome for one widget on the grid: title, and the edit-mode
 * controls (configure, remove). The layout is FIXED (Kanban main
 * design, locked 2026-11-19) — no drag handle, no move/resize
 * controls, no dnd-kit. In view mode the chrome is just the title —
 * the widget content is identical. `span` is the fixed column span
 * for this widget type in the grid; rows size to content.
 */
export function WidgetShell({
  title,
  span,
  editing,
  children,
  onConfigure,
  onRemove,
}: {
  title: string;
  span: number;
  editing: boolean;
  children: ReactNode;
  onConfigure: () => void;
  onRemove: () => void;
}) {
  return (
    <section
      aria-label={title}
      style={{ gridColumn: `span ${span} / span ${span}` }}
      className="flex flex-col rounded-card border border-line bg-white shadow-[0_1px_2px_rgba(17,24,39,0.04)]"
    >
      <header className="flex items-center gap-2 border-b border-line px-5 py-3">
        <h3 className="flex-1 truncate text-sm font-semibold text-ink">{title}</h3>
        {editing && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onConfigure}
              aria-label={`Configure ${title}`}
              className="rounded-full bg-pill px-2 py-1 text-xs font-medium text-ink transition-colors hover:bg-line"
            >
              Settings
            </button>
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove ${title}`}
              className="rounded-full bg-pill px-2 py-1 text-xs font-medium text-risk transition-colors hover:bg-risk-light"
            >
              ✕
            </button>
          </div>
        )}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}
