# Integrations — Agilytics OS v2

> **Goal: a full-fledged platform where a company manages everything without
> switching tabs.** Integrations are embedded data + actions inside Agilytics,
> not just notifications. A Slack message becomes a ticket. A GitHub PR moves
> a ticket's status. A Notion doc lives inside Project Docs. A calendar event
> becomes action items.

## Phasing (feature rework, approved 2026-11-17)

- **Phase 1:** thin Slack + GitHub (post to Slack, link PRs, commit →
  ticket) **and Jira / ClickUp import** (projects, tickets, statuses
  mapped to reporting categories, users, attachments) — the funded
  slice must contain the thing that lost the deal, and import is what
  makes switching possible.
- **Phase 2:** Notion + Google connections, realtime boards.
- **Phase 3:** AI over connected data.

## Tiers

### Tier 1 — native first (build these first)

| Provider                 | What it does inside Agilytics                                                                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Slack**                | Channel alerts (ticket created / overdue / at-risk), create a task from a message, daily digest to a channel, slash commands (`/agilytics create …`) |
| **GitHub**               | Link PRs/commits to tickets, ticket status moves on PR merge, PR list inside the ticket, branch naming from ticket ID                                |
| **Notion**               | Sync/link docs to projects, embed Notion docs in Project Docs (the escape hatch for teams that live in Notion — we do not rebuild Notion)            |
| **Google Calendar**      | Sprint deadlines and due dates as calendar events, meeting → action items                                                                            |
| **Gmail / Google Drive** | Attach Drive files to tickets/projects, create a task from an email                                                                                  |

### Tier 2 — next

Microsoft Teams + Outlook, Figma (embed designs, link frames to
tickets), Linear, Zoom / Google Meet, Stripe (billing). **Jira is not
in Tier 2 — Jira / ClickUp import is Phase 1** (see Phasing above).

### Tier 3 — escape hatch

Generic webhooks (outgoing + incoming), Zapier / Make connector, CSV
import / export. This answers "does it connect to X?" for every app we
haven't built natively yet.

## Import — Jira / ClickUp (Phase 1)

Import is a first-class Phase 1 slice, not a Tier 2 catalogue item:
import projects, tickets (with `key`, `type`, `parentId` hierarchy),
statuses mapped to reporting categories (`TODO` / `IN_PROGRESS` /
`DONE`), users, and attachments from a Jira/ClickUp export. Endpoint:
`POST /api/v1/integrations/import`. Switching cost is the real risk
for a Jira competitor — import is what makes adoption possible.

## How a provider is built — the registry

One provider = one file, same interface, in
`apps/api/src/modules/integrations/providers/`:

```ts
interface IntegrationProvider {
  provider: IntegrationProviderKind; // SLACK | GITHUB | NOTION | GOOGLE | …
  connect(tenantId: string, code: string): Promise<void>; // OAuth code → tokens
  disconnect(tenantId: string): Promise<void>;
  sync(tenantId: string): Promise<void>; // pull/push state
  handleWebhook(tenantId: string, payload: unknown): Promise<void>;
}
```

The registry (`registry.ts`) maps a provider name to its implementation.
Adding a provider means adding one file + one registry entry — no changes
to the controller, the queue, or the web app.

Current state (Phase 2, 2026-11-19): **live OAuth for Slack, GitHub,
Notion and Google** (Calendar + Gmail + Drive, stored as
`GOOGLE_CALENDAR`), plus the generic webhook escape hatch. Tokens are
encrypted with the TokenVault (AES-256-GCM placeholder — see Security
below) and stored per workspace in `Integration.encryptedCredentials`;
the old `__TODO_KMS_ENCRYPTED__` placeholder is gone. Notion
(`@notionhq/client`) and Google (`googleapis`) providers are real —
`notion.provider.ts`, `google.provider.ts`, `webhook.provider.ts` —
registered in `registry.ts`. Zapier / Make have no native provider:
they consume the generic webhook (see § Webhooks).

## OAuth flow (all providers)

1. Web: `GET /api/v1/integrations/:provider/authorize` (JWT-authed)
   returns `{ authorizeUrl }`. The page opens it in a new tab/popup.
2. The provider redirects the browser to
   `GET /api/v1/integrations/:provider/callback?code&state` — a
   **public** route, because the provider redirect carries no JWT.
   The `state` is an HMAC-signed `tenantId + nonce`
   (`oauth-state.ts`); the callback verifies it and never trusts a raw
   tenantId from the query string. A forged or cross-tenant state is
   rejected before any code exchange.
3. The provider exchanges the code for tokens (Slack `oauth.v2.access`,
   GitHub `POST /login/oauth/access_token`, Notion
   `POST /v1/oauth/token`, Google `OAuth2Client.getToken`), encrypts
   them and upserts the Integration row (`tenantId + provider` unique).
   Connect / disconnect are written to AuditLog.
4. The callback 302-redirects to `/connections/callback?provider&status`
   in the web app, which shows success/failure and closes the popup.
5. Missing client id/secret env vars → the authorize endpoint returns
   **503 "not configured — set …"**, never a crash. Thin endpoints
   (`slack/post`, `github/pull-requests`) use the stored per-workspace
   token first, fall back to the legacy env token (`SLACK_BOT_TOKEN` /
   `GITHUB_TOKEN`), and fail with a clear "not connected" error when
   neither exists.

Redirect URIs (must be allow-listed in each provider app, built from
`API_BASE`, default `http://localhost:3001`):

| Provider | Redirect URI |
| -------- | ------------ |
| Slack | `{API_BASE}/api/v1/integrations/SLACK/callback` |
| GitHub | `{API_BASE}/api/v1/integrations/GITHUB/callback` |
| Notion | `{API_BASE}/api/v1/integrations/NOTION/callback` |
| Google | `{API_BASE}/api/v1/integrations/GOOGLE_CALENDAR/callback` (or `GOOGLE_REDIRECT_URI`) |

## What each provider does (Phase 2)

- **Slack** — OAuth bot token; post to channels (workspace token first,
  env fallback); `sync` lists visible channels.
- **GitHub** — OAuth token; list open PRs, filter by ticket key.
- **Notion** — OAuth bot token; `sync` lists accessible pages/databases
  and stores them as link records; `POST notion/databases/:id/link`
  pins one to a project. No incoming webhook (Notion has none).
- **Google** — one connection, three surfaces: Calendar (list upcoming
  events; create an event from a sprint deadline), Gmail (list recent
  messages; create a ticket from one — subject → title), Drive (list
  files; attach a Drive link to a ticket as a linked Document).
- **Webhook** — outgoing URL + shared secret per workspace (stored
  encrypted); outgoing events are HMAC-signed
  (`X-Agilytics-Signature`); incoming `POST /integrations/webhook/incoming`
  verifies the signature against each workspace's secret (the secret
  routes the payload to its tenant) and creates/updates a ticket.

## Webhooks — Zapier / Make (no separate code)

Zapier and Make consume the same generic webhook: Zapier "Webhooks by
Zapier" (Catch Hook trigger / POST action), Make "Custom Webhook"
module. Outgoing: point the workspace webhook URL at the Zapier/Make
hook URL and verify `X-Agilytics-Signature` (`sha256=<hmac-sha256 of
JSON.stringify(body)>` with the shared secret). Incoming: have the Zap
/ scenario POST `{ projectId, title, description?, priority? }` (or
`{ ticketId | ticketKey, title?, description? }` to update) to
`/api/v1/integrations/webhook/incoming` with the same signature header.

## Jhon's manual steps (must be done by Jhon — no sandbox can do these)

1. **Slack app** — https://api.slack.com/apps → Create New App → OAuth
   & Permissions → add Redirect URL
   `{API_BASE}/api/v1/integrations/SLACK/callback`, scopes
   `channels:read, chat:write, commands` → copy Client ID + Client Secret
   into `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET`.
2. **GitHub OAuth app** — https://github.com/settings/developers →
   New OAuth App → Authorization callback URL
   `{API_BASE}/api/v1/integrations/GITHUB/callback` → copy Client ID +
   Client Secret into `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`.
3. **Notion integration** — https://www.notion.so/my-integrations →
   New integration → OAuth → add Redirect URI
   `{API_BASE}/api/v1/integrations/NOTION/callback` → copy OAuth Client
   ID + Client Secret into `NOTION_CLIENT_ID` / `NOTION_CLIENT_SECRET`,
   then share the pages/databases with the integration in Notion.
4. **Google OAuth client** — https://console.cloud.google.com → APIs &
   Services → Credentials → Create OAuth client ID (Web application) →
   Authorized redirect URI
   `{API_BASE}/api/v1/integrations/GOOGLE_CALENDAR/callback` (or set
   `GOOGLE_REDIRECT_URI` to a different allow-listed URI) → copy into
   `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. Enable the Calendar,
   Gmail and Drive APIs in the same project.
5. **Token key** — set `TOKEN_ENCRYPTION_KEY` in the API `.env`
   (generate: `openssl rand -hex 32`). Without it the API uses an
   ephemeral in-memory key: tokens work until the next restart, then
   every provider must be re-connected.
6. **Public API base** — set `API_BASE` to the deployed API's public URL
   before connecting from anywhere but localhost, and use that same
   value in every provider app's redirect URI.
7. Restart the API, open Connections, click Connect, approve in the
   provider tab. **Live OAuth cannot be verified in the sandbox** —
   it needs real provider apps + secrets + a browser redirect; the
   unit tests cover the vault, state signing and webhook HMAC only.

## Security

- OAuth tokens are encrypted at rest before storage
  (`Integration.encryptedCredentials`) — **currently with the
  TokenVault: AES-256-GCM, key derived from `TOKEN_ENCRYPTION_KEY`
  via scrypt with a random salt + IV per value**
  (`token-vault.service.ts`). **This is an env-based AES placeholder,
  NOT AWS KMS**: anyone holding the env var can decrypt the tokens.
  After funding, swap the vault's internals for KMS envelope
  encryption — the storage column and call sites do not change. Never
  plaintext, never in logs. Without `TOKEN_ENCRYPTION_KEY` the API
  generates an ephemeral in-memory key and warns loudly: tokens then
  do not survive a restart.
- One connection record per workspace per provider (`tenantId` + `provider`
  unique). Tokens are scoped to the minimum OAuth scopes the feature needs.
- Every connect / disconnect / sync is written to the `AuditLog`.
- Webhook handlers verify the provider's signature before acting
  (Slack signing secret, GitHub webhook secret) — TODO in each provider.
  The **generic** webhook verifies its HMAC (`X-Agilytics-Signature`)
  before acting; the OAuth callback verifies its signed `state`.
- Full detail: `SECURITY.md`.

## Automations — trigger → action

Automation rules (`AutomationRule` table) connect a trigger to an action,
across providers. Implemented in Phase 2
(`apps/api/src/modules/integrations/automation.service.ts`, CRUD at
`POST/GET /api/v1/integrations/automations`, toggle at
`POST /api/v1/integrations/automations/:id/toggle`):

| Trigger | Fired by |
| --- | --- |
| `ticket.created` | `TicketsService.create` (one-line bus emit) |
| `ticket.status_changed` | `TicketsService.changeStatus` (one-line bus emit) |
| `ticket.done` | `changeStatus` when the new column category is `DONE` |
| `ticket.overdue` | Overdue sweep — `POST /api/v1/integrations/automations/sweep` (no daily update in 3 days, same rule as reporting); the worker calls this endpoint on an interval — see "Overdue sweep scheduler" below |
| `daily_update.created` | `DailyUpdatesService.upsertToday` (one-line bus emit) |
| `sprint.completed` | `POST /sprints/:id/complete` (SprintsService, backend end-to-end slice 2026-11-19) |
| `comment.created` | `POST /tickets/:id/comments` (CommentsService, backend end-to-end slice 2026-11-19) |

| Action | Behaviour |
| --- | --- |
| `slack.post` | Post to `config.channel` (or `SLACK_DEFAULT_CHANNEL`); skipped with a warning when Slack is not connected |
| `github.comment` | Comment on `config.owner/config.repo#config.prNumber` (via the provider when it gains a comment method, else direct Octokit with `GITHUB_TOKEN`); skipped when unconfigured |
| `notification.create` | Inbox notification (`AUTOMATION` type) for the assignee / `config.userId` |
| `ticket.update` | Set status category (via `TicketsService.changeStatus`, so history is written), priority, assignee |
| `webhook.post` | POST the event JSON to `config.url` — the generic escape hatch |

Rules are tenant-scoped, guarded by the existing `AUTOMATIONS_MANAGE`
permission, and audited. Evaluation is fire-and-forget on a plain
event bus (`apps/api/src/common/automation-events.ts` — no DI cycle
with the tickets module): a failed rule can never break the request
that raised the event. Config supports `{placeholders}` templates and
an optional `filters` object (`toCategory`, `projectId`, `priority`,
`assigneeId`). The rule builder UI lives in the Connections page.

Examples (also seeded for demo-tenant):

- `ticket.overdue` → `slack.post` (nudge the assignee in their channel)
- `sprint.completed` → `notion.sync` (post the weekly report to Notion)
- `ticket.done` → `github.comment` (comment on the linked PR)
- `meeting.ended` → `ticket.create` (action items from the meeting notes — not in the Phase 2 catalog)

### Overdue sweep scheduler (worker, 2026-11-19)

`SweepSchedulerService` (`apps/worker/src/jobs/sweep-scheduler.service.ts`,
wired in `WorkerModule`) runs the overdue sweep on an in-process interval —
no paid scheduler, no SQS in this slice. Every tick it POSTs
`/api/v1/integrations/automations/sweep`; the `automation.run` job
(`JobsService`) delegates to the same `runSweepOnce()`, so the sweep also
runs when the job is enqueued. Spec:
`apps/worker/src/jobs/sweep-scheduler.service.spec.ts` (fake timers).

| Env | Default | Meaning |
| --- | --- | --- |
| `SWEEP_API_BASE_URL` | `http://localhost:3001` | API base URL (no `/api/v1` suffix) |
| `SWEEP_INTERVAL_MS` | `900000` (15 min) | Interval between sweeps |
| `SWEEP_ENABLED` | `true` | `false` disables the scheduler |
| `SWEEP_API_TOKEN` | — (required) | Bearer token for the sweep call |

**Auth gap (deliberate — the endpoint's auth is NOT weakened):** the sweep
endpoint is guarded by `JwtAuthGuard` + `AUTOMATIONS_MANAGE`, and the
token's tenant claim decides which tenant is swept, so the worker needs an
operator-provisioned JWT for a service user that holds `AUTOMATIONS_MANAGE`
in the tenant to sweep. With no `SWEEP_API_TOKEN` the scheduler logs a
warning and stays off, and the sweep only runs when an admin presses "Run
overdue sweep" in the Connections page. A real service-account scheme (one
token per tenant, or a service-auth header the API verifies) is a backend
follow-up, not a silent downgrade of the endpoint.

**Production path:** replace the in-process interval with SQS / EventBridge
— the scheduler enqueues one `automation.run` job per tenant (the worker
already has the SQS client in `QueueService`) instead of calling the API
directly. The endpoint, the `ticket.overdue` evaluation and the audit trail
do not change.

## Packages (pinned)

- Slack: `@slack/web-api` + `@slack/bolt`
- GitHub: `@octokit/rest` + `@octokit/webhooks`
- Notion: `@notionhq/client`
- Google: `googleapis`
- Queue: `@aws-sdk/client-sqs` (no Redis / BullMQ — see ARCHITECTURE.md §6)
- Files: `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`
- Email: `@aws-sdk/client-ses`
