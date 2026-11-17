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

- **Gateway:** `@nestjs/websockets` + socket.io, one gateway in
  `apps/api` (`modules/realtime/`). It runs in the API task — no
  separate realtime service on day one.
- **Rooms (tenant-scoped):**
  - `workspace:{tenantId}` — board updates, sprint changes, dashboard
    KPI refresh triggers.
  - `ticket:{ticketId}` — comments, status moves, assignee changes on
    one ticket.
  - A socket joins a room only after the handshake JWT proves
    membership of that tenant; joining another tenant's room is rejected
    and audit-logged.
- **Events (first set):** live board updates (ticket moved/created),
  comments, **presence** (who is viewing a ticket/board), **typing
  indicators** (comment composer), and **notifications** (mentions,
  assignments, automation results).
- **Auth on handshake:** the socket handshake carries the Cognito JWT;
  the gateway verifies it against the Cognito JWKS (same verifier as
  the REST `JwtAuthGuard`) and reads `tenant_id` from the claims. No
  token, no connection. Reconnect re-verifies.
- **Cross-task fan-out — Redis/Valkey pub-sub (the Phase 2 dependency).**
  With more than one Fargate task, a board update emitted on task A
  must reach sockets connected to task B. That needs a pub-sub adapter:
  **Redis/Valkey, ElastiCache Serverless**, as the socket.io adapter
  backing store. This is **documented here, NOT added to the scaffold**:
  no Redis/Valkey, no ElastiCache, no adapter package is installed yet.
  Phase 2 adds `@socket.io/redis-adapter` (or the Valkey equivalent),
  the ElastiCache Serverless Terraform, and the adapter wiring in the
  gateway — and only then may the API scale past one task for realtime.
  Until that lands, run the API as a single task for any socket traffic
  (REST still scales horizontally; only realtime fan-out is pinned).

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

- Everything in Phase 2 (gateway, rooms, events, Redis/Valkey adapter,
  ElastiCache Terraform) and Phase 3 (activity feed, live cursors).
- The SSE endpoint is a 501 stub; no notification storage exists.
- No socket client in the web app — `socket.io-client` is not
  installed; Phase 2 adds it behind a `useRealtime` hook that falls
  back to polling when the socket is unavailable.
