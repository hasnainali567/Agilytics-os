import { NOTIFICATION_TYPE_LABELS, type NotificationItem } from "./notifications.api";

const TYPE_STYLES: Record<NotificationItem["type"], string> = {
  MENTION: "bg-lime-light text-forest",
  ASSIGNMENT: "bg-done/10 text-done",
  BLOCKER: "bg-risk/10 text-risk",
  AUTOMATION: "bg-warn/10 text-warn",
  SYSTEM: "bg-pill text-muted",
};

export function NotificationList({
  items,
  onMarkRead,
}: {
  items: NotificationItem[];
  onMarkRead: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="p-5 text-sm text-muted">
        No notifications here. Mentions, assignments and blockers will land in this inbox.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-line">
      {items.map((item) => (
        <li
          key={item.id}
          className={`flex items-start gap-3 px-5 py-4 ${item.isRead ? "" : "bg-canvas"}`}
        >
          {!item.isRead && (
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500" aria-label="Unread" />
          )}
          {item.isRead && (
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-line" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_STYLES[item.type]}`}
              >
                {NOTIFICATION_TYPE_LABELS[item.type]}
              </span>
              <span className="text-xs text-muted">
                {new Date(item.createdAt).toLocaleString()}
              </span>
            </div>
            <p className={`mt-1 text-sm ${item.isRead ? "text-muted" : "font-medium text-ink"}`}>
              {item.title}
            </p>
            {item.body ? <p className="mt-0.5 text-sm text-muted">{item.body}</p> : null}
          </div>
          {!item.isRead && (
            <button
              type="button"
              onClick={() => onMarkRead(item.id)}
              className="shrink-0 rounded-full border border-line bg-panel px-3 py-1 text-xs font-medium text-ink hover:bg-canvas"
            >
              Mark read
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
