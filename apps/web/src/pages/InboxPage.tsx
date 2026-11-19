import { useState } from "react";
import { TopBar } from "../components/layout";
import { Button, Card, CardHeader } from "../components/ui";
import { INBOX_FILTERS, type InboxFilter } from "../features/notifications/notifications.api";
import { NotificationList } from "../features/notifications/NotificationList";
import { UnreadBadge } from "../features/notifications/UnreadBadge";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "../features/notifications/use-notifications";

/** Notification Inbox page — one list, read/unread, filter by type.
 *  Route wiring is NOT in this slice (router.tsx is owned by the
 *  orchestrator): add the route snippet from the Slice C report. */
export function InboxPage() {
  const [filter, setFilter] = useState<InboxFilter>("ALL");
  const { data, isPending, isError } = useNotifications(filter);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar title="Inbox" />
      <main className="space-y-4 p-6">
        <Card>
          <CardHeader
            title="Notifications"
            subtitle="Mentions, assignments, blockers and automations — one list"
          />
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
            {INBOX_FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  filter === option.value
                    ? "bg-forest text-white"
                    : "bg-canvas text-ink hover:bg-line"
                }`}
              >
                {option.label}
              </button>
            ))}
            <span className="ml-auto flex items-center gap-2">
              <UnreadBadge />
              <Button variant="secondary" onClick={() => markAllRead.mutate()}>
                Mark all read
              </Button>
            </span>
          </div>
          {isPending ? (
            <p className="p-5 text-sm text-muted">Loading your inbox…</p>
          ) : isError || !data ? (
            <div className="p-5 text-sm">
              <p className="font-semibold text-ink">The API isn't reachable.</p>
              <p className="text-muted">
                Start it with <code>docker compose up -d</code> then{" "}
                <code>pnpm --filter api start:dev</code>. No mock data is shown.
              </p>
            </div>
          ) : (
            <NotificationList items={data} onMarkRead={(id) => markRead.mutate(id)} />
          )}
        </Card>
      </main>
    </div>
  );
}
