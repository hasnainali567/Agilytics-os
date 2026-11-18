# Agilytics OS — Architecture (v2, final)

> **Clean modular monolith first. NOT microservices on day one.**
> This architecture is deliberately new and scalable — it does **not** copy
> the v1 Agilytics shape (79% client components, a 25 KB monolithic sidebar,
> hand-rolled panels per route, no tests, RLS off, no module boundaries).
>
> Status: **design complete, awaiting Jhon's approval** (2026-11-17). No
> further coding until approved — see
> [`DESIGN-DECISIONS.md`](DESIGN-DECISIONS.md). End-to-end design:
> [`SYSTEM-DESIGN.md`](SYSTEM-DESIGN.md). Deep dives: `docs/`.

## 1. Principles

1. **One API, one worker, one database.** One NestJS API (`apps/api`),
   one worker (`apps/worker`, same codebase shape, separate Fargate task),
   one Postgres (RDS). No service mesh, no Kafka, no EKS on day one.
2. **Bounded contexts as NestJS modules.** Each context owns its tables,
   its routes, and its rules. A module may import only:
   - its own files,
   - shared infrastructure (`PrismaService`, guards, decorators),
   - contracts from `packages/shared` (Zod schemas + TypeScript types).
     **No cross-module imports.** If two modules need to talk, they do it
     through a shared contract, an event, or a queue job — never by importing
     each other's services.
3. **Server-by-default on the API, thin client on the web.** The API owns
   validation, authorisation, tenant scoping, and aggregation. The web app
   (Vite SPA, behind login) is a thin client: it fetches via TanStack Query
   and renders shared primitives. It holds no business rules.
4. **Small files, one thing per file, reuse before create.** Target ~150
   lines per file. Shared dashboard primitives are the _only_ way to build
   a dashboard surface — no hand-rolled panels per route.
5. **No mock data in the tree.** Pages fetch the real API and render
   loading / empty / error states. Local dev data comes from the Prisma
   seed (`apps/api/prisma/seed.ts`), not from a `mock-data.ts` file.
6. **No unused dependencies — except pinned SDKs.** A package that is not
   imported does not belong in `package.json`, **except** the SDKs Jhon
   pinned on 2026-11-17 (Slack, GitHub, Notion, Google, Playwright,
   LangChain adapters), which may be installed before their first use.
   They are recorded as pinned-for-next-slice, not accidental unused deps.

## 2. Bounded contexts (NestJS modules)

| Module          | Owns                                                                                                                                                                                                                   | Routes                                                                                                                           |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `identity`      | Users, organisations, memberships, **custom roles + permissions** (Role, PermissionKey catalog, RolePermission join; PermissionsGuard)                                                                                 | `GET /identity/me`, `GET/POST /roles`, `PATCH/DELETE /roles/:id`, `PUT /roles/:id/permissions`, `GET /permissions`               |
| `projects`      | Projects: key, lead, dates, type (software / ops / internal)                                                                                                                                                           | `GET/POST /projects`                                                                                                             |
| `boards`        | Custom workflows: boards + admin-defined columns, optional WIP limit                                                                                                                                                   | `GET/POST /boards`, `POST/PATCH/DELETE /boards/:id/columns` (workspace OWNER/ADMIN only)                                         |
| `sprints`       | Sprints (dates + goal), Backlog, capacity, burndown, carry-over                                                                                                                                                        | `GET/POST /sprints`                                                                                                              |
| `tickets`       | Tickets: key, type (EPIC/STORY/TASK/BUG), parent (epic/subtask), labels, custom fields, watchers, attachments, links, status history, comments                                                                         | `GET/POST /tickets`, `PATCH /tickets/:id/status` (column id, history who/when/from/to), List + Board views, bulk edit            |
| `time-tracking` | Time entries (fed by DailyUpdate `timeSpentMin`), per ticket/sprint/project totals                                                                                                                                     | `GET/POST /tickets/:id/time-entries` (Phase 2)                                                                                   |
| `daily-updates` | Daily updates (per ticket/member/day), Today feed, My Work, blockers                                                                                                                                                   | `POST/GET /tickets/:id/daily-updates`, `GET /daily-updates/today`, `GET /daily-updates/blockers`, `GET /daily-updates/my-work`   |
| `teams`         | Teams: persistent org units with lead, description, capacity                                                                                                                                                           | `GET/POST /teams`                                                                                                                |
| `docs`          | Project Docs (not a wiki): docs under a project/ticket/sprint, PM templates                                                                                                                                            | `GET/POST /documents`, `POST /documents/:id/upload-url`                                                                          |
| `reporting`     | Dashboard KPIs, velocity, CFD, cycle time, time-in-status, burndown, workload, My Work, generated weekly reports (no decks); **dashboard layouts** (per-user customisable dashboard, see §10 / `docs/FRONTEND.md` §1B) | `GET /reporting/dashboard-summary`, `GET /reporting/weekly`, `GET/PUT /dashboard/layout`, `POST /dashboard/layout/reset`         |
| `integrations`  | Connections, OAuth tokens (KMS), automations, Jira/ClickUp import (Phase 1)                                                                                                                                            | `GET /integrations`, `POST /integrations/:provider/connect`, `POST /integrations/:provider/webhook`, `POST /integrations/import` |
| `realtime`      | Notification Inbox (Phase 1); notification stream stub; WebSocket gateway (Phase 2)                                                                                                                                    | `GET /notifications`, `GET /notifications/stream` (501 stub)                                                                     |
| `ai`            | LangChain agent (read-only tools, memory), RAG, ask-your-workspace; paid/no-retention provider for real pilot data, free tiers dev/demo only                                                                           | `POST /ai/ask`, `GET /ai/status` (503 `ai_not_configured` with no key) — see `docs/AI.md`                                        |
| `admin`         | Platform admin: tenants, users, audit log, health                                                                                                                                                                      | `GET /admin/*` (PLATFORM_ADMIN only)                                                                                             |

Cross-cutting: `auth` (Cognito JWT guard), `prisma` (PrismaService + RLS
session tenant), `health`. Shared contracts: `packages/shared` (Zod +
types), `packages/ai` (LangChain provider interface).

## 3. Data model overview

Postgres (RDS) + `pgvector` for AI RAG. Every tenant-owned table has
`tenantId` and RLS enabled. Full schema:
`apps/api/prisma/schema.prisma`; tables + relations:
[`SYSTEM-DESIGN.md` §4](SYSTEM-DESIGN.md).

- **Tenancy:** `organisations` (tenant) → `memberships` (user × tenant ×
  role) → everything else scoped by `tenantId`.
- **Roles & permissions (decision 21, Phase 1):** `roles`
  (tenant-scoped, free-text name, `isSystem` for the five seeded
  built-ins OWNER/ADMIN/LEAD/MEMBER/VIEWER) + `PermissionKey` enum
  (fixed catalog, 42 keys grouped by area — see SYSTEM-DESIGN.md
  §2.1) + `role_permissions` join (a grant is a row). `Membership`
  references a `Role` (`roleId`); the legacy fixed `MemberRole` enum
  is a migration fallback only. Enforcement is a server-side
  `PermissionsGuard` + `@RequirePermissions(...)` decorator on every
  mutation, deny-by-default; the frontend only hides what the user
  lacks. Role/permission changes are audit-logged; deleting a role in
  use is refused.
- **Work:** `projects` (key, lead, dates, type) → many `boards` →
  `board_columns` (free-text name, order, colour, reporting `category`,
  optional WIP limit); `sprints` (dates + goal, capacity, retrospective,
  with a Backlog of un-sprinted tickets); `tickets` (key, type
  EPIC/STORY/TASK/BUG, parent for epic/subtask hierarchy, board + column,
  priority, estimate, assignee, labels, custom fields, watchers,
  attachments, links).
- **Tracking:** `ticket_status_history` (every move: who/when/from/to);
  `ticket_links` (BLOCKS / BLOCKED_BY / RELATES_TO / DUPLICATES);
  `time_entries` (fed by DailyUpdate `timeSpentMin`); `daily_updates`
  (one per member/ticket/day — the source for the Today feed, My Work,
  stale detection, blockers, trends); `comments` (discussion only, with
  @mentions); `notifications` (Notification Inbox).
- **Docs:** `documents` are **Project Docs, not a wiki** — they live under
  a project, ticket or sprint, with a PM template (PRD / spec / sprint
  plan / retro). No standalone Doc Hub wiki, no global docs library, no
  separate docs homepage. Notion docs are linked/embedded via the Notion
  integration instead of rebuilding Notion.
- **Platform:** `integrations` (KMS-encrypted OAuth tokens),
  `automation_rules` (trigger → action), `audit_logs` (append-only).
- **Customisation (per user, not per workspace):**
  `dashboard_layouts` — one user's saved dashboard layout(s): layout
  JSON with widget id/type/position/size/config plus a `ui` block
  (density, sidebar state, visible nav items), `isDefault`, and the
  role template it started from. Unique per user per layout name,
  tenant-scoped, RLS enabled. The Agibankz theme is fixed and is NOT
  in the layout — customisation is what you see and where, not
  re-skinning. The reporting engine underneath never changes, so a
  custom dashboard can never break a report.

Key rule: **there is no fixed ticket-status enum.** A ticket's status is
a `BoardColumn` id; reporting reads the column's `category`
(`TODO` / `IN_PROGRESS` / `DONE`), never its name. See
[`docs/WORKFLOWS.md`](docs/WORKFLOWS.md).

## 4. Multi-tenancy & security

- `tenantId` on every tenant-owned row; Postgres RLS as the second layer
  (see [`SECURITY.md`](SECURITY.md)).
- Cognito JWT → `tenantId` claim → request context → every query scoped.
- RBAC per workspace is **permission-based, not role-name-based**
  (decision 21): a workspace admin defines custom roles and toggles
  their permissions; every mutation requires a permission key, checked
  server-side by `PermissionsGuard`, deny-by-default. Platform roles
  (`PLATFORM_ADMIN/PLATFORM_SUPPORT`) are a separate axis.
- Audit log on every sensitive action; append-only.
- Full detail: `SECURITY.md`.

## 5. Privacy boundary — what we as the platform can (and can never) see

This is a **product promise, not just a policy.** Full text:
[`docs/PRIVACY-BOUNDARY.md`](docs/PRIVACY-BOUNDARY.md).

- **We DO see/manage:** tenant metadata (company name, plan, billing
  status, user count, storage usage, feature flags), system health /
  uptime / error rates, the platform audit log **of our own admin
  actions**, support tickets the customer filed, and aggregated anonymous
  usage counts (never content).
- **We NEVER see (no application-level access):** ticket
  titles/descriptions, daily updates, comments, documents/files,
  messages, AI prompts/outputs, integration tokens (KMS-encrypted),
  passwords, or any customer business data. Stated honestly: engineers
  with production database credentials technically could read RDS —
  the promise is **no application-level access, encrypted, audited,
  contractually barred**, not physical impossibility. There is no admin
  endpoint that lists customer content and no impersonation.
- **Enforcement:** tenant scoping + RLS on every query; no admin endpoint
  that lists customer content; no impersonation/backdoor; support access
  only with explicit tenant consent, time-boxed, logged, and revocable;
  encryption at rest/in transit; secrets in Secrets Manager.
- **Platform admins are not members of any tenant.** `PLATFORM_ADMIN`
  grants access to tenant metadata and platform operations — never to a
  tenant's data.

## 6. Async work — the worker

`apps/worker` is a standalone NestJS application context (no HTTP server).
It consumes jobs from SQS: AI summaries, integration syncs, notification
digests, automation actions, daily-update reminders. The API only
_enqueues_ — it never does slow work in a request handler. In local dev
the worker runs with a stub consumer; the SQS wiring lands with the
first real job (AI weekly summary).

## 7. Integrations — embedded, not just notifications

Full catalog: [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md). Tier 1 native
first — **thin Slack + GitHub land in Phase 1** (post to Slack, link PRs,
commit → ticket), Notion + Google in Phase 2 — Tier 2
(Teams/Outlook, Figma, Linear, Zoom/Meet, Stripe), Tier 3 escape hatch
(webhooks, Zapier/Make, CSV). **Jira / ClickUp import is in Phase 1**
(switching cost is the adoption risk): import projects, tickets, statuses
(mapped to reporting categories), users, attachments. One provider = one
file, same interface
(`apps/api/src/modules/integrations/providers/`), registry-based,
KMS-encrypted OAuth tokens, per-workspace connections, automation rules
(trigger → action) evaluated by the worker. Goal: a company manages
everything without switching tabs — embedded data + actions, not just
notifications.

## 8. AI — LangChain.js agents

Full doc: [`docs/AI.md`](docs/AI.md). **LangChain.js is the agent
framework** (tools, memory, RAG, multi-step agents) — the OpenAI SDK is
NOT the primary client. Provider is chosen by `AI_PROVIDER` env through
one interface in `packages/ai` (`@langchain/openai` pointable at
OpenRouter, `@langchain/google-genai`, `@langchain/groq`,
`@langchain/ollama`). **AI privacy rule (feature rework 2026-11-17):
free tiers (Gemini free, OpenRouter `:free`, Groq free) are for dev and
demo data only. Any pilot workspace with real client data runs on a paid,
no-retention provider — Gemini paid by default, $20/workspace/month cap
(Decision Sheet Q4).** Cap enforcement is a Phase 3 gate, not a
nice-to-have. **LangChain is free/open-source; it does NOT make LLMs
free** — you pay the provider unless on a free tier or local. The API
agent (`POST /ai/ask`) uses read-only, tenant-scoped tools; no key
configured → 503, never a hallucinated answer. Write/action tools arrive
in Phase 3, behind explicit per-action approval.

## 9. Daily Updates + custom workflows

Full doc: [`docs/WORKFLOWS.md`](docs/WORKFLOWS.md).

- **Daily Updates:** one per member per ticket per day (upsert) — done
  today, next, blockers (+ flag), progress %, health, time spent. They
  feed the Today feed, **My Work** (assigned to me, due today/overdue,
  blocked, mentioned, my updates due), stale-ticket detection
  ("silent / stale tracking", not "quiet-member detection"), per-person
  tracking, and velocity/progress trends. **Burden control:** the
  composer is a 2-minute form, pre-filled from yesterday + linked GitHub
  activity, with a per-person day view — or people will stop doing it.
  `timeSpentMin` writes to `TimeEntry` (one source, not two). Comments
  alone cannot do any of this.
- **Custom workflows:** unlimited boards per project, unlimited
  workspace-admin-defined statuses (free-text name, order, colour,
  reporting category). The workspace admin / company head — **not** the
  platform admin — manages them from the Workflow settings page. Default
  template on project creation is a starting point only. Status history
  records every change (who/when/from/to) so time-in-status, cycle time,
  and stale detection work with custom names. **Custom workflows pair
  with custom roles (decision 21):** a company that names its own
  statuses must also be able to name its own roles and decide who may
  change a workflow (`boards.manage_workflow`) — the two halves of
  company-owned customisation.

## 10. Frontend architecture

Full doc: [`docs/FRONTEND.md`](docs/FRONTEND.md). Vite SPA (React 19,
TypeScript strict) on Vercel — no SSR/SEO, behind login. TanStack Router
(code-based routes now; **target: file-based routes with lazy-loaded
chunks**), TanStack Query as the only server-state layer (keys per
workspace/project/ticket, invalidation by key, optimistic updates),
Zustand for client UI state only (sidebar, filters, modals — never
server data). Feature folders per domain (`features/projects`,
`features/tickets`, `features/sprints`, `features/reports`,
`features/admin`, `features/integrations`); `shared/` for design-system
primitives + hooks + lib; `services/` as typed API clients from the
shared Zod contracts — **no direct fetch in components**. Performance:
route code-splitting, virtualised long lists, memoised charts, skeleton
loaders. Accessibility: keyboard, ARIA, focus management.

**Home is Today / My Work first** (not a social feed): assigned to me,
due today/overdue, blocked, mentioned, my Daily Updates due — then the
team Today feed below. **The dashboard is customisable per user
(Phase 1, decision 20):** every card is a widget (KPI, velocity,
workload donut, Today feed, blockers, at-risk, My Work, AI brief) on
a drag/resize grid; each widget's stats, project/sprint/team scope
and time range are configurable; layouts are saved per user,
auto-saved, synced across devices, resettable in one click, seeded
from role templates (Manager / Lead / Developer / Viewer). UI prefs
(density comfortable/compact, sidebar collapsed/expanded, visible nav
items) are per user too. The Agibankz theme stays the system — no
user-chosen colours/skins. Full spec:
[`docs/FRONTEND.md` §1B](docs/FRONTEND.md). Tickets have **List +
Board views**, bulk edit, saved filters. Weekly reports are **generated, shareable reports**
(email / Slack / PDF export) — **no slide-deck builder** (cut). Design
system: **Agibankz (locked 2026-11-17, decision 19)** — warm off-white
`~#F4F4F2` canvas, white cards, lime `~#A9E85C` accent, deep forest
green `~#0F3D20` for primary actions only, geometric sans (Inter /
Plus Jakarta Sans / Poppins), 20–24px card radii, pill `999px`
buttons/nav, flat with almost no shadow. **No dark hero card** — the
hero is a white card (57%) + lime card (43%) split. The one addition
over the pin is a left sidebar in the same tokens (workspace switcher,
Home/Today, Projects, Boards, Sprints, Reports, Doc Hub, Connections,
Automations, AI, Admin, user card at the bottom). Pin 1 Employee
Dashboard is a supporting reference only; Pin 3 DealDeck stays the
Reports layout. Full tokens, sidebar spec, hero and bottom-column
mappings: [`docs/FRONTEND.md` §1A](docs/FRONTEND.md). The old
direction (dark navy sidebar, white canvas, deep-blue primary) is
superseded and must not be used anywhere new.

## 11. Realtime

Full doc: [`docs/REALTIME.md`](docs/REALTIME.md). Three phases:

- **Phase 1 (now):** TanStack Query polling/refetch + **Notification
  Inbox** (read/unread, filter by mention / assignment / blocker /
  automation) + SSE-ready notification endpoint stub
  (`GET /notifications/stream` → 501). No WebSocket.
- **Phase 2:** NestJS WebSocket gateway (`@nestjs/websockets` +
  socket.io) — live board updates, comments, presence (who is viewing a
  ticket/board), typing indicators, notifications. Tenant-scoped rooms
  (`workspace:{id}`, `ticket:{id}`), Cognito JWT on handshake.
  **Redis/Valkey pub-sub (ElastiCache Serverless) is the documented
  Phase 2 dependency for cross-task fan-out — NOT added yet.**
- **Phase 3:** full activity feed + live cursors / presence avatars.

## 12. Deployment — AWS + Vercel

- **Web:** Vercel (Vite SPA, static, HTTPS).
- **API + worker:** AWS ECS Fargate (one service each, small tasks:
  256 CPU / 512 MiB to start) behind an ALB + WAF, in private subnets.
- **Data:** RDS Postgres (single-AZ `db.t4g.small` to start, automated
  backups + PITR on), S3 (files, versioned), SQS (jobs), Cognito User
  Pool (MFA). Region: `ap-south-1` (OPEN QUESTION Q2).
- **Infra:** Terraform skeleton in `infra/terraform/` (VPC, ECS, RDS,
  S3, SQS, Cognito, ALB) — clearly marked skeleton, **not yet applied**.
- **Secrets:** env vars / AWS Secrets Manager only; GitHub Actions OIDC
  for deploys (no long-lived AWS keys).

## 13. CI/CD

GitHub Actions (`.github/workflows/ci.yml`) on PRs and pushes to `main`:
`pnpm install --frozen-lockfile` → `pnpm -r typecheck` → `pnpm -r lint`
→ `pnpm -r test` → `pnpm -r build`. Husky + lint-staged on pre-commit
(Prettier + ESLint). Branching (same discipline as v1): feature branches
off `main`, only production-ready tested work merges; `main` is the
fallback. First push: the repo `hasnainali567/agilytics-os` already
exists (empty, `main`) — push after design approval + build verification.

## 14. Observability

- Health endpoints: `GET /health` (API), `GET /admin/health` (platform).
- Structured logs with tenant + request ids; token-usage logging for
  every AI call (cost tracking); audit log for sensitive actions.
- **Still to wire (OPEN QUESTION Q10):** metrics/alerts (CloudWatch
  alarms) and error tracking (Sentry?) — tools and first pages to be
  decided with Jhon.

## 15. Cost-lean choices

Small Fargate tasks, single-AZ RDS to start, SQS instead of a broker, no
EKS, no ElastiCache, no Kafka, no multi-region. Free-tier AI providers
are for **dev/demo data only** (Gemini free / OpenRouter `:free` / Groq
free / Ollama local); real pilot data runs on a paid, no-retention
provider. Every "not yet" below is a cost decision as much as a scope
decision: add it only when load or a customer contract demands it.

## 16. Scalability — how this grows without a rewrite

Scalability comes from **clean module boundaries + tenant scoping + async
queues**, not from running many services on day one:

- **Read load:** reporting queries move to an RDS read replica (one config
  change in the reporting module — its queries already go through one service).
- **Hot module:** a module can be extracted to its own service later
  **without a rewrite**, because it already has its own tables, its own
  routes, and no imports from other modules. Extraction path:
  1. give the module its own NestJS app + Fargate service,
  2. point its routes at the new service (same `/api/v1` paths, same
     `packages/shared` contracts — clients don't change),
  3. move its tables (they're already isolated by `tenantId` + module prefix),
  4. replace in-process calls with SQS events (the contracts already exist).
- **Tenant load:** tenant scoping is in every query, so per-tenant
  throttling, quotas, and (later) per-tenant databases are policy changes,
  not refactors.

## 17. What we are NOT adding yet — and why

| Not adding                         | Why                                                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Microservices / EKS / service mesh | One team, one product. A modular monolith deploys faster, debugs faster, and costs far less. Extract later, per §16.      |
| Kafka / RabbitMQ / Redis broker    | SQS covers async jobs. Add a broker only when ordering / streaming semantics are actually needed.                         |
| ElastiCache / Redis                | No cache is needed until read load proves it. Needed for Phase 2 realtime fan-out — add it then, behind the gateway only. |
| GraphQL                            | REST + versioned `/api/v1` + OpenAPI is enough for one client (our web app) and for integrations.                         |
| Multi-region / active-active       | One region (ap-south-1) until a customer contract requires more.                                                          |
| Separate marketing site / SSR      | Internal tool, behind login. The web app is a Vite SPA on Vercel.                                                         |
| Slide-deck builder / Decks product | Not a PM feature; v1 dead code. Weekly reports are generated reports (email / Slack / PDF), not decks.                    |
| Standalone Doc Hub wiki            | Notion-clone shape. Docs are Project Docs attached to work; Notion via integration.                                       |
| Home as a social feed              | Bootcamp shape. Home is Today / My Work first.                                                                            |

## 18. Repo map

```
apps/web        React 19 + Vite SPA (Vercel)
apps/api        NestJS modular monolith (ECS Fargate)
apps/worker     NestJS worker — SQS jobs (AI, integrations, notifications)
packages/shared Zod schemas + types — the cross-app contract
packages/ai     LangChain provider interface (AI_PROVIDER env)
infra/terraform AWS skeleton (VPC, ECS, RDS, S3, SQS, Cognito, ALB)
docs/           AI, FRONTEND (Agibankz design system, §1A), INTEGRATIONS, REALTIME, WORKFLOWS, PRIVACY-BOUNDARY
ARCHITECTURE.md / SYSTEM-DESIGN.md / DESIGN-DECISIONS.md / SECURITY.md
```
