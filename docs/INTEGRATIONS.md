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

Current state (scaffold): **Slack and GitHub provider skeletons exist**
(`slack.provider.ts`, `github.provider.ts`) with real SDK clients
(`@slack/web-api`, `@octokit/rest`) and TODOs for the live OAuth flow.
Notion (`@notionhq/client`) and Google (`googleapis`) skeletons are next —
their SDKs are already pinned in `apps/api/package.json`.

## Security

- OAuth tokens are **encrypted with AWS KMS** before storage
  (`Integration.encryptedCredentials`). Never plaintext, never in logs.
- One connection record per workspace per provider (`tenantId` + `provider`
  unique). Tokens are scoped to the minimum OAuth scopes the feature needs.
- Every connect / disconnect / sync is written to the `AuditLog`.
- Webhook handlers verify the provider's signature before acting
  (Slack signing secret, GitHub webhook secret) — TODO in each provider.
- Full detail: `SECURITY.md`.

## Automations — trigger → action

Automation rules (`AutomationRule` table) connect a trigger to an action,
across providers:

- `ticket.overdue` → `slack.post` (nudge the assignee in their channel)
- `sprint.completed` → `notion.sync` (post the weekly report to Notion)
- `ticket.done` → `github.comment` (comment on the linked PR)
- `meeting.ended` → `ticket.create` (action items from the meeting notes)

Rules are evaluated by the worker (`apps/worker`), never in a request
handler. The rule builder UI lives in the Connections page.

## Packages (pinned)

- Slack: `@slack/web-api` + `@slack/bolt`
- GitHub: `@octokit/rest` + `@octokit/webhooks`
- Notion: `@notionhq/client`
- Google: `googleapis`
- Queue: `@aws-sdk/client-sqs` (no Redis / BullMQ — see ARCHITECTURE.md §6)
- Files: `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`
- Email: `@aws-sdk/client-ses`
