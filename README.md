# Agilytics OS — v2 (from scratch)

> **Agilytics OS** is a production-ready, AI-powered operating system for teams
> and project management — the successor to Agilytics v1.
> Internal tool for companies/businesses. No public marketing pages, no SEO, no SSR.

## Why v2, from scratch?

v1 (`hasnainali567/Agilytics`, branch `muse-main`) was built as a learning
project under bootcamp-trainer instructions, for managing bootcamps — not as a
company project-management tool. It has no tests, no AI layer, a flat
achromatic UI, and a Nov 2026 audit found RLS disabled on all 25 tables plus
cross-workspace IDORs. It is **proof of execution only** (it ran 3 Saylani
bootcamps) — **not a feature reference for v2** (see
`FEATURE-EVALUATION.md`, approved 2026-11-17). V2 is judged against
Jira / ClickUp / Linear / Plane + what companies asked for. No v1 code,
schema, or security assumptions were copied into v2.

Locked design direction: **Agibankz** (pin
`https://www.pinterest.com/pin/834151162281618403/`, Delibix) is THE
design — warm off-white `~#F4F4F2` canvas, white cards, lime `~#A9E85C`
accent, deep forest green `~#0F3D20` for primary actions only,
geometric sans (Inter / Plus Jakarta Sans / Poppins), 20–24px card
radii, pill `999px` buttons/nav, flat with almost no shadow. **No dark
hero card** — the hero is a white card (57%) + lime card (43%) split.
The one addition over the pin is a left sidebar in the same tokens.
Pin 1 Employee Dashboard is a supporting reference only (KPI cards,
member table); **Pin 3 DealDeck** stays the Reports layout (KPI row,
big bar chart, donut) and **Pin 5** the toggles for Connections.
Tweak, don't copy: banking content is replaced with sprint velocity,
ticket status, workload, and at-risk members. Full tokens:
[`docs/FRONTEND.md` §1A](docs/FRONTEND.md). The old direction (dark
navy sidebar, white canvas, deep-blue primary) is superseded.

Locked stack (2026-11-17):

| Layer        | Choice                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend     | React 19 + Vite SPA (no SSR/SEO — behind login), TypeScript strict, TanStack Router + TanStack Query, Zustand, Tailwind v4 + shadcn-style components, Recharts, dnd-kit, React Hook Form + Zod. Deployed on **Vercel**.                                                                                                                                                                                                                                                                                                                                                                                                            |
| Backend      | NestJS + TypeScript, Prisma, PostgreSQL. Deployed on **AWS ECS Fargate** behind an ALB.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Auth         | AWS Cognito (one user pool, `tenant_id` in the token, MFA; SAML/OIDC SSO later). JWT guard placeholder in `apps/api` — see `apps/api/README.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Data         | RDS Postgres, `tenantId` on **every** table + Postgres RLS from day one. S3 for files, SQS for async jobs (AI, integrations, notifications). No EKS, no ElastiCache yet — add only when load demands it.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| AI           | **LangChain.js agent framework** — `packages/ai` provider interface (`AI_PROVIDER`: Gemini paid (default for real pilot data, $20/workspace/month cap) / Gemini free tier / OpenRouter `:free` / Groq free tier / Ollama local for dev and demo data only; OpenAI as paid fallback), API agent at `POST /ai/ask` with read-only workspace tools + memory, worker for long jobs, pgvector RAG, workspace-scoped retrieval only. Full doc: [`docs/AI.md`](docs/AI.md). LangChain is free/open-source — it does **not** make LLMs free; you pay the provider unless on a free tier or local. Free tiers never carry real client data. |
| Integrations | Connections hub first: thin Slack + GitHub in Phase 1, Notion + Google in Phase 2, plus Jira/ClickUp import in Phase 1, Zapier/Make/webhook escape hatch. OAuth tokens encrypted with KMS, per-workspace, audit-logged. Automation builder: trigger → action. Full catalog: [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md).                                                                                                                                                                                                                                                                                                        |
| Infra        | Terraform (`infra/terraform/`), GitHub Actions with OIDC, dev / staging / prod.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

## Packages (pinned — locked 2026-11-17)

| Area          | Packages                                                                                                                                                                                                                                                                                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth          | Cognito User Pool; backend `@nestjs/passport` + `passport-jwt` + `jwks-rsa`, `@aws-sdk/client-cognito-identity-provider`; frontend `aws-amplify` (v6 auth)                                                                                                                                                                                                       |
| DB            | `@prisma/client` + `prisma` CLI, PostgreSQL + `pgvector` extension for AI RAG, Prisma Migrate                                                                                                                                                                                                                                                                    |
| API           | NestJS core, `@nestjs/config`, `class-validator` + `class-transformer`, `@nestjs/swagger` (OpenAPI), `helmet`, `@nestjs/throttler`                                                                                                                                                                                                                               |
| Queue/async   | `@aws-sdk/client-sqs` (no Redis/BullMQ — see ARCHITECTURE.md §6)                                                                                                                                                                                                                                                                                                 |
| Files / email | `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, `@aws-sdk/client-ses`                                                                                                                                                                                                                                                                                    |
| Frontend      | React 19, Vite, `@tanstack/react-router`, `@tanstack/react-query`, `zustand`, Tailwind v4, `@radix-ui/*` via shadcn-style components, `recharts`, `@dnd-kit/core`, `react-hook-form` + `zod`, `date-fns`, `lucide-react`                                                                                                                                         |
| Integrations  | `@slack/web-api` + `@slack/bolt`, `@octokit/rest` + `@octokit/webhooks`, `@notionhq/client`, `googleapis`                                                                                                                                                                                                                                                        |
| AI            | LangChain.js: `langchain`, `@langchain/core`, `@langchain/community`, `@langchain/langgraph`, adapters `@langchain/openai` (pointable at OpenRouter via baseURL), `@langchain/google-genai`, `@langchain/groq`, `@langchain/ollama` — provider via `AI_PROVIDER` env, single interface in `packages/ai`. The `openai` SDK is **not** used as the primary client. |
| Testing/QA    | `vitest`, `@testing-library/react`, `@playwright/test`, `@nestjs/testing`, `supertest`                                                                                                                                                                                                                                                                           |
| Tooling       | pnpm + Turborepo, TypeScript strict, ESLint + Prettier, Husky + lint-staged                                                                                                                                                                                                                                                                                      |
| Infra         | Terraform AWS provider, Docker                                                                                                                                                                                                                                                                                                                                   |

## Architecture

Clean modular monolith first — **not** microservices on day one. One NestJS
API + one worker, one Postgres, bounded contexts as NestJS modules
(identity/tenants, projects, sprints/tickets (epics, subtasks, dependencies, time tracking), project docs, teams/members, reporting, integrations/automations, admin, AI), no cross-module imports except through
shared contracts in `packages/shared`. Small files (~150 lines), shared
dashboard primitives only, no mock data in the tree, no unused dependencies.
Scalability comes from clean module boundaries + tenant scoping + async
queues, so a module can be extracted to its own service later without a
rewrite. Full detail, including the extraction path and what we are
**not** adding yet (EKS, Kafka, ElastiCache, GraphQL, multi-region) and why:
[`ARCHITECTURE.md`](ARCHITECTURE.md).

## Monorepo layout

```
apps/web        React 19 + Vite SPA (Vercel)
apps/api        NestJS API (AWS ECS Fargate)
apps/worker     NestJS worker — SQS jobs: AI, integrations, notifications
packages/shared Zod schemas + TypeScript types shared by web and api
packages/ai     LangChain provider interface (AI_PROVIDER env) shared by api + worker
infra/terraform AWS skeleton (VPC, ECS, RDS, S3, SQS, Cognito, ALB)
.github/workflows CI: install, typecheck, lint, test, build
```

## Docs

- [`SYSTEM-DESIGN.md`](SYSTEM-DESIGN.md) — **start here**: end-to-end system design (diagrams, API surface, schema, flows)
- [`DESIGN-DECISIONS.md`](DESIGN-DECISIONS.md) — every locked decision (2026-11-17) + open questions for Jhon
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — modular monolith, bounded contexts, extraction path, what we are NOT adding yet
- [`SECURITY.md`](SECURITY.md) — data security from day one (tenant isolation + RLS, Cognito + MFA, RBAC, KMS, audit log)
- [`docs/PRIVACY-BOUNDARY.md`](docs/PRIVACY-BOUNDARY.md) — what we as the platform can (and can never) see — a product promise
- [`docs/AI.md`](docs/AI.md) — LangChain.js agents, providers (free tiers vs paid), cost control
- [`docs/FRONTEND.md`](docs/FRONTEND.md) — frontend architecture: routing, TanStack Query, Zustand, feature folders, performance, a11y
- [`docs/REALTIME.md`](docs/REALTIME.md) — realtime in three phases: polling now, WebSocket gateway + Redis/Valkey later, activity feed + presence last
- [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md) — integrations catalog (Tier 1/2/3), provider registry, automations
- [`docs/WORKFLOWS.md`](docs/WORKFLOWS.md) — Daily Updates (per ticket/member/day) + custom workflows (unlimited boards, admin-defined statuses, no fixed status enum)
- [`FEATURE-EVALUATION.md`](FEATURE-EVALUATION.md) — feature rework, approved 2026-11-17: what was cut, redesigned and added when v1 stopped being a feature reference

## Pushing to GitHub

The repo already exists: **hasnainali567/agilytics-os** (empty, default
branch `main`). This scaffold was built locally only — nothing has been
pushed. First push (after build verification):

```bash
cd ~/workspace/agilytics-os
git add -A
git commit -m "feat: scaffold Agilytics OS v2 (modular monolith)"
git remote add origin git@github.com:hasnainali567/agilytics-os.git
git branch -M main
git push -u origin main
```

Then select the repo for the Muse GitHub App if it isn't already, so Muse
can work in it.

## Local dev

```bash
pnpm install
cp .env.example .env          # then fill in DATABASE_URL etc.
docker compose up -d          # local Postgres (db) — API + web run on the host
pnpm dev                      # web on :5173, api on :3001 (see apps/*/README)
```

Or run each app separately:

```bash
pnpm --filter web dev
pnpm --filter api start:dev
pnpm --filter api prisma:migrate   # apply migrations to local Postgres
pnpm --filter api prisma:seed
```

## Production-readiness checklist

- [x] Multi-tenancy by design: `tenantId` on every table, RLS policies in migration
- [x] Versioned API (`/api/v1`), OpenAPI via `@nestjs/swagger`
- [x] Zod validation shared between web and api (`packages/shared`)
- [x] Auth guard placeholder ready for Cognito (no secrets in repo)
- [x] Audit log table (`AuditLog`)
- [x] CI: typecheck, lint, test, build on every PR
- [x] Terraform skeleton with cost-lean defaults
- [x] Platform Admin Panel scaffolded (`/admin` web + `GET /api/v1/admin/*` API, PLATFORM_ADMIN guard, no impersonation — see SECURITY.md §4)
- [x] Security documented in `SECURITY.md` (tenant isolation + RLS, Cognito + MFA, RBAC, encryption at rest/in transit, KMS for integration tokens, secrets via Secrets Manager, audit log, rate limiting + WAF, backups + PITR, least-privilege IAM)
- [ ] Cognito user pool wired + applied in Terraform (skeleton only)
- [ ] Apply Terraform to AWS (dev, then staging, then prod)
- [ ] RLS verified by a cross-tenant test; `dev-login` removed/disabled in production
- [ ] MFA enforced for platform admins; no secrets in git history (gitleaks in CI)
- [ ] Backups + PITR verified with a real restore; dependency audit in CI
- [ ] Real data: the web app fetches the real API and renders loading /
      empty / error states — there is **no mock data file** in the tree. Local
      dev data comes from the Prisma seed (`pnpm --filter api prisma:seed`).
- [ ] AI worker jobs (SQS consumer + OAuth flows for integrations are TODO) — the LangChain agent itself exists (`POST /api/v1/ai/ask`, read-only tools, `AI_PROVIDER` env; see `docs/AI.md`), and per-workspace budget enforcement + RAG retrieval are still TODO
- [ ] E2E tests (Playwright), Sentry, rate limiting, WAF rules
- [ ] Billing / plans, SSO (SAML/OIDC), per-tenant backups

## Security

See [`SECURITY.md`](SECURITY.md) — data security is the top priority for
software-house customers. Tenant isolation (tenantId + RLS), Cognito + MFA,
RBAC, encryption, KMS, audit log, and the no-backdoor rule for support access
are all built in from day one, not bolted on later.

## Branching (same discipline as v1)

`main` is production. Feature work on `feature/<name>` / `muse/<name>` branches
off `main`, proper commits, PR + CI green before merge. Only tested,
production-ready work lands on `main`.
