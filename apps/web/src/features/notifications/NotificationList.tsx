import { NOTIFICATION_TYPE_LABELS, type NotificationItem } from "./notifications.api";

const TYPE_STYLES: Record<NotificationItem["type"], string> = {
  MENTION: "bg-[#EFEAFE] text-[#6C5CE7]",
  ASSIGNMENT: "bg-[#DCFCE7] text-[#16A34A]",
  BLOCKER: "bg-[#FEE2E2] text-[#DC2626]",
  AUTOMATION: "bg-[#FEF3C7] text-[#B45309]",
  SYSTEM: "bg-[#F2F3F7] text-[#6B7280]",
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
      <div className="px-5 py-10 text-center">
        <p className="text-sm font-medium text-[#111827]">All caught up</p>
        <p className="mt-1 text-sm text-[#6B7280]">
          No notifications here. Mentions, assignments and blockers will land in this inbox.
        </p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-[#E5E7EB]">
      {items.map((item) => (
        <li
          key={item.id}
          className={`flex items-start gap-3 px-5 py-4 ${item.isRead ? "" : "bg-[#EFEAFE]/40"}`}
        >
          {!item.isRead && (
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#6C5CE7]"
              aria-label="Unread"
            />
          )}
          {item.isRead && (
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#E5E7EB]" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${TYPE_STYLES[item.type]}`}
              >
                {NOTIFICATION_TYPE_LABELS[item.type]}
              </span>
              <span className="text-xs text-[#6B7280]">
                {new Date(item.createdAt).toLocaleString()}
              </span>
            </div>
            <p
              className={`mt-1 text-sm ${item.isRead ? "text-[#6B7280]" : "font-medium text-[#111827]"}`}
            >
              {item.title}
            </p>
            {item.body ? <p className="mt-0.5 text-[13px] text-[#6B7280]">{item.body}</p> : null}
          </div>
          {!item.isRead && (
            <button
              type="button"
              onClick={() => onMarkRead(item.id)}
              className="shrink-0 rounded-full border border-[#E5E7EB] bg-white px-3 py-1 text-xs font-medium text-[#111827] transition-colors hover:bg-[#EFEAFE] hover:text-[#6C5CE7]"
            >
              Mark read
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
