import { useState } from "react";
import { TopBar } from "../components/layout";
import { Card, CardHeader } from "../components/ui";
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
    <div className="flex min-h-full flex-col bg-[#E9EEF5]">
      <TopBar title="Inbox" />
      <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:px-6">
        <header>
          <p className="text-xs font-medium text-[#6B7280]">Workspace / Inbox</p>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#111827]">Inbox</h1>
              <p className="mt-1 text-sm text-[#6B7280]">
                Mentions, assignments, blockers and automations — one list.
              </p>
            </div>
            <span className="flex items-center gap-2">
              <UnreadBadge />
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="rounded-[10px] bg-[#6C5CE7] px-4 py-2 text-sm font-medium text-white shadow-[0_1px_2px_rgba(108,92,231,0.4)] transition-colors hover:bg-[#5B4BD6] disabled:opacity-50"
              >
                Mark all read
              </button>
            </span>
          </div>
        </header>

        <Card className="overflow-hidden">
          <CardHeader
            title="Notifications"
            subtitle="Newest first — unread items are highlighted"
          />
          <div className="flex flex-wrap items-center gap-2 border-b border-[#E5E7EB] px-5 py-3">
            {INBOX_FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                  filter === option.value
                    ? "bg-[#6C5CE7] text-white shadow-[0_1px_2px_rgba(108,92,231,0.4)]"
                    : "bg-[#E9EEF5] text-[#111827] hover:bg-[#EFEAFE] hover:text-[#6C5CE7]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {isPending ? (
            <p className="p-5 text-sm text-[#6B7280]">Loading your inbox…</p>
          ) : isError || !data ? (
            <div className="p-5 text-sm">
              <p className="font-semibold text-[#111827]">The API isn't reachable.</p>
              <p className="text-[#6B7280]">
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
