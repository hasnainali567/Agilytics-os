# Realtime design

## 1. Principles

- **Tenant-scoped, always.** Every realtime channel is bound to a
  workspace (tenant) and, where relevant, a ticket or board. There is no
  global broadcast channel and no cross-tenant room — a socket that
  cannot prove its tenant gets nothing.
- **Auth before subscribe.** The Cognito JWT is verified on the
  WebSocket handshake (Phase 2); the same `tenant_id` claim that scopes
  REST queries scopes rooms.
- **Polling now, sockets later.** Phase 1 ships without a WebSocket so
  the product works on one Fargate task with zero extra infrastructure.
  Sockets arrive in Phase 2, when live collaboration is the feature —
  not before.
- **Realtime is a progressive enhancement.** Every live view also works
  as a polled/refetched view; if the socket drops, TanStack Query
  refetch takes over and the UI never goes stale silently.

## 2. Phase 1 — scaffold now

- **TanStack Query polling / refetch.** The dashboard query refetches
  on a 30s interval (`refetchInterval`, see `HomePage.tsx`); board and
  ticket queries refetch on focus and after mutations (invalidation by
  query key, see `docs/FRONTEND.md` §3). This is the whole of Phase 1
  realtime — good enough for velocity, workload and at-risk lists.
- **SSE-ready notification endpoint stub.** `GET /api/v1/notifications/stream`
  exists in `apps/api` (`modules/realtime/`) as a stub: it sets SSE
  headers and returns **501 `realtime_not_implemented`** until the event
  pipeline lands. The endpoint shape is fixed now so the web can
  subscribe to it later without an API change. No events are emitted
  yet, and no notification rows are stored yet.
- **Notification Inbox (Phase 1).** The notification home: one list
  (`GET /api/v1/notifications`), read/unread, filter by mention /
  assignment / blocker / automation. This is the Phase 1 notification
  surface — the stream feeds it when it lands.
- **No WebSocket in Phase 1.** No `@nestjs/websockets`, no socket.io,
  no Redis — deliberately.

## 3. Phase 2 — live collaboration (NestJS WebSocket gateway)

**BUILT (Phase 2, worker c).** One gateway in `apps/api`
(`modules/realtime/realtime.gateway.ts`), registered in
`RealtimeModule` alongside the kept-as-is SSE 501 stub.

- **Gateway:** `@nestjs/websockets` + socket.io (`socket.io`,
  `@nestjs/platform-socket.io` in the API; `socket.io-client` in the
  web behind `useRealtime`, `apps/web/src/lib/useRealtime.ts`). It
  runs in the API task — no separate realtime service.
- **Rooms (tenant-scoped):**
  - `workspace:{tenantId}` — board updates, sprint changes, dashboard
    KPI refresh triggers. Auto-joined on connect.
  - `ticket:{ticketId}` — comments, status moves, assignee changes on
    one ticket. Joined via a `joinTicket` event, only after the
    gateway checks the ticket belongs to the socket's tenant;
    joining another tenant's room is rejected and audit-logged
    (`realtime.room_join_rejected`).
- **Events (first set, live):** `ticket.created`, `ticket.updated`,
  `ticket.status_changed`, `daily_update.created`,
  `notification.created`. Emitted by the injectable `RealtimeService`
  (`emitToWorkspace` / `emitToTicket`) through the event bus — one-line
  fire-and-forget hooks in `TicketsService` (create / status change),
  `DailyUpdatesService` (upsert) and `NotificationsService`
  (`createForUser`, the canonical writer). Emits never break the
  request that triggered them.
- **Auth on handshake:** the socket handshake carries the stored JWT
  (`handshake.auth.token` or `?token=`); the gateway verifies it with
  the SAME verification as the REST `JwtAuthGuard`
  (`apps/api/src/modules/realtime/socket-auth.ts` — symmetric
  dev-login JWT today; the Cognito JWKS swap is documented there).
  No token / invalid token = no connection. Reconnect re-verifies.
- **Presence + typing (minimal, ephemeral):** `presence.join` /
  `presence.leave` broadcast `{userId, name, ticketId/boardId}` to the
  room; `typing.start` / `typing.stop` broadcast a `typing` event.
  Presence state lives only in gateway memory and expires on
  disconnect — never persisted. **Live cursors are still Phase 3.**
- **Rate-limit:** excess presence/typing pings per connection are
  dropped, not queued (`PresenceRateLimiter`: 20 events / 10s window
  per connection).
- **Web client:** `useRealtime(ticketId?)` — singleton socket, joins
  the workspace room, joins the ticket room on demand, exposes
  connection status + presence/typing lists. On `ticket.*` /
  `daily_update.created` / `notification.created` it invalidates the
  matching TanStack Query keys (`tickets`, `dashboard/summary`,
  `notifications`) so the board/dashboard refresh live. Wired into
  the board page, the dashboard, and the `TopBar` (`LiveIndicator`:
  Live / Reconnecting / Offline). **Polling stays the fallback:**
  dashboard `refetchInterval` (30s), refetch-on-focus and
  invalidation after mutations are unchanged — if the socket is
  unavailable or drops, the UI keeps working and never goes blank.
- **Cross-task fan-out — event bus with two backends**
  (`apps/api/src/modules/realtime/event-bus.service.ts`):
  - **In-memory (default):** local dev, single task, no Redis
    required — the app boots and realtime works with zero extra
    infrastructure.
  - **Redis/Valkey (optional):** enabled only when `REDIS_URL` is set
    (see `apps/api/.env.example`). `ioredis` is loaded lazily, so the
    app still boots without Redis; a Redis failure degrades to a
    logged warning and in-memory delivery. One channel,
    `agilytics:realtime`; the gateway subscribes and fans envelopes
    out to rooms on its task, so an event emitted on task A reaches
    sockets on task B.
  - **Still TODO:** ElastiCache Serverless Terraform, and the
    `@socket.io/redis-adapter` as the socket.io adapter backing store
    (the bus covers event fan-out; the adapter would additionally
    sync room membership across tasks). Until that lands, run the API
    as a single task for any socket traffic (REST still scales
    horizontally; only realtime fan-out is pinned).

## 4. Phase 3 — full live experience

- **Activity feed:** a persisted, tenant-scoped feed (ticket created,
  moved, commented, sprint started) rendered live from the same events
  Phase 2 emits — the feed is the stored form of the socket events.
  The **activity timeline** (ticket/project, Phase 2) is built from
  existing tables (status moves + comments + updates + automation runs,
  newest first) — build the feed once, from this.
- **Live cursors / presence avatars:** who is on this board, where
  their cursor/selection is, avatars stacked on the ticket being viewed.
  Presence state is ephemeral (socket-scoped, never persisted as
  tenant data) and expires on disconnect.
- **Notification centre:** the Phase 1 SSE stub becomes the real
  stream, backed by stored notification rows + the Phase 2 gateway.
  The Phase 1 **Notification Inbox** is the surface it feeds.

## 5. Security notes

- Rooms are authorised per join, not per connection — a socket's tenant
  is re-checked when it asks for `ticket:{id}` (the ticket must belong
  to that tenant).
- Presence/typing payloads carry user ids and display names only —
  never tokens, never other tenants' data.
- Rate-limit socket events per connection (same 100 req/60s posture as
  REST, tuned for events); drop, do not queue, excess presence pings.
- Every rejected room join is audit-logged.

## 6. What is NOT built yet

- Phase 3 (activity feed, live cursors).
- ElastiCache Serverless Terraform and the `@socket.io/redis-adapter`
  backing store (the event bus already fans events across tasks when
  `REDIS_URL` is set; see §3).
- The SSE endpoint is still a 501 stub; the notification stream is
  served over the WebSocket (`notification.created`) instead.
- Time tracking (Phase 2, worker c) — **BUILT**: the ticket
  `GET/POST/DELETE /tickets/:id/time-entries` endpoints already
  existed and were verified, not re-implemented. Added:
  `GET /reporting/time?sprintId=&projectId=` (totals = sum of minutes
  grouped by member/ticket, plus total hours), the ticket detail panel
  (entries list + total + add-entry form), and a per-sprint time
  report section on the Reports page. `DailyUpdate.timeSpentMin`
  still syncs to `TimeEntry` via the existing
  `TimeEntriesService.syncFromDailyUpdate` hook in
  `DailyUpdatesService.upsertToday` — verified, not duplicated.
