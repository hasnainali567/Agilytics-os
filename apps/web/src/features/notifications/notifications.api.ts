import { apiUrl } from "../../lib/query-client";

/** Notification Inbox — Phase 1 surface (SYSTEM-DESIGN §3.7, FRONTEND.md §1).
 *  Real data only, from GET /api/v1/notifications. No mock data. */

export type NotificationType = "MENTION" | "ASSIGNMENT" | "BLOCKER" | "AUTOMATION" | "SYSTEM";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  entity?: string | null;
  entityId?: string | null;
  title: string;
  body?: string | null;
  isRead: boolean;
  createdAt: string;
}

export type InboxFilter = "ALL" | "UNREAD" | NotificationType;

export const INBOX_FILTERS: { value: InboxFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "UNREAD", label: "Unread" },
  { value: "MENTION", label: "Mentions" },
  { value: "ASSIGNMENT", label: "Assignments" },
  { value: "BLOCKER", label: "Blockers" },
  { value: "AUTOMATION", label: "Automations" },
];

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  MENTION: "Mention",
  ASSIGNMENT: "Assignment",
  BLOCKER: "Blocker",
  AUTOMATION: "Automation",
  SYSTEM: "System",
};

export function filterNotifications(
  items: NotificationItem[],
  filter: InboxFilter,
): NotificationItem[] {
  if (filter === "ALL") return items;
  if (filter === "UNREAD") return items.filter((n) => !n.isRead);
  return items.filter((n) => n.type === filter);
}

export async function fetchNotifications(filter: InboxFilter): Promise<NotificationItem[]> {
  const params = new URLSearchParams();
  if (filter === "UNREAD") params.set("unreadOnly", "true");
  if (filter !== "ALL" && filter !== "UNREAD") params.set("type", filter);
  const query = params.toString();
  const res = await fetch(`${apiUrl}/notifications${query ? `?${query}` : ""}`);
  if (!res.ok) {
    throw new Error(`Notifications API failed: ${res.status}`);
  }
  return (await res.json()) as NotificationItem[];
}

export async function fetchUnreadCount(): Promise<number> {
  const res = await fetch(`${apiUrl}/notifications/unread-count`);
  if (!res.ok) {
    throw new Error(`Notifications API failed: ${res.status}`);
  }
  const data = (await res.json()) as { unread: number };
  return data.unread;
}

export async function markNotificationRead(id: string): Promise<void> {
  const res = await fetch(`${apiUrl}/notifications/${id}/read`, { method: "PATCH" });
  if (!res.ok) {
    throw new Error(`Mark notification read failed: ${res.status}`);
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  const res = await fetch(`${apiUrl}/notifications/read-all`, { method: "PATCH" });
  if (!res.ok) {
    throw new Error(`Mark all notifications read failed: ${res.status}`);
  }
}
