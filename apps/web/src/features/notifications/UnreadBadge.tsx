import { useUnreadCount } from "./use-notifications";

/** Unread badge for the inbox — renders nothing when there is nothing unread. */
export function UnreadBadge() {
  const { data: unread } = useUnreadCount();
  if (!unread) return null;
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold text-white">
      {unread > 99 ? "99+" : unread}
    </span>
  );
}
