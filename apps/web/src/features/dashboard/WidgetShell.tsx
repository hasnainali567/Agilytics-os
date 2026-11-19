import { useDraggable } from "@dnd-kit/core";
import type { ReactNode } from "react";
import type { WidgetPlacement } from "./types";

/**
 * Card chrome for one widget on the grid: drag handle, title, and the
 * edit-mode controls (configure, resize, move, remove). In view mode
 * the chrome is just the title — the widget content is identical.
 */
export function WidgetShell({
  placement,
  title,
  editing,
  children,
  onConfigure,
  onRemove,
  onResize,
  onMove,
}: {
  placement: WidgetPlacement;
  title: string;
  editing: boolean;
  children: ReactNode;
  onConfigure: () => void;
  onRemove: () => void;
  onResize: (dw: number, dh: number) => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: placement.id,
    disabled: !editing,
  });
  return (
    <section
      ref={setNodeRef}
      aria-label={title}
      style={{
        gridColumn: `span ${placement.w} / span ${placement.w}`,
        gridRow: `span ${placement.h} / span ${placement.h}`,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        zIndex: isDragging ? 10 : undefined,
        opacity: isDragging ? 0.85 : undefined,
      }}
      className="flex flex-col rounded-card border border-line bg-panel"
    >
      <header className="flex items-center gap-2 border-b border-line px-5 py-3">
        {editing && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Drag ${title} to rearrange`}
            className="flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-full bg-pill text-sm text-muted active:cursor-grabbing"
          >
            ⠿
          </button>
        )}
        <h3 className="flex-1 truncate text-sm font-semibold text-ink">{title}</h3>
        {editing && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onMove(-1)}
              aria-label={`Move ${title} earlier`}
              className="rounded-full bg-pill px-2 py-1 text-xs font-medium text-ink"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => onMove(1)}
              aria-label={`Move ${title} later`}
              className="rounded-full bg-pill px-2 py-1 text-xs font-medium text-ink"
            >
              →
            </button>
            <button
              type="button"
              onClick={() => onResize(0, -1)}
              aria-label={`Make ${title} shorter`}
              className="rounded-full bg-pill px-2 py-1 text-xs font-medium text-ink"
            >
              −H
            </button>
            <button
              type="button"
              onClick={() => onResize(0, 1)}
              aria-label={`Make ${title} taller`}
              className="rounded-full bg-pill px-2 py-1 text-xs font-medium text-ink"
            >
              +H
            </button>
            <button
              type="button"
              onClick={() => onResize(-1, 0)}
              aria-label={`Make ${title} narrower`}
              className="rounded-full bg-pill px-2 py-1 text-xs font-medium text-ink"
            >
              −W
            </button>
            <button
              type="button"
              onClick={() => onResize(1, 0)}
              aria-label={`Make ${title} wider`}
              className="rounded-full bg-pill px-2 py-1 text-xs font-medium text-ink"
            >
              +W
            </button>
            <button
              type="button"
              onClick={onConfigure}
              aria-label={`Configure ${title}`}
              className="rounded-full bg-pill px-2 py-1 text-xs font-medium text-ink"
            >
              Settings
            </button>
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove ${title}`}
              className="rounded-full bg-pill px-2 py-1 text-xs font-medium text-risk"
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
