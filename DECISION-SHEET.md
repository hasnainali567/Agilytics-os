# Decision sheet — answer this, then the overnight build starts

> Draft, 2026-11-17 (evening, Asia/Karachi). NOT locked. Every line below is a
> **recommended default** — reply "yes to all" to approve them as-is, or
> "change Qx to …" for any line you disagree with. Saying "approved" also
> approves the design pack (`ARCHITECTURE.md`, `SYSTEM-DESIGN.md`,
> `DESIGN-DECISIONS.md`, `docs/`) for the overnight build and the first push
> to `hasnainali567/agilytics-os` (repo exists, empty — verified 2026-11-17,
> no commits yet). **Update 2026-11-17: the feature rework
> (`FEATURE-EVALUATION.md`) is APPROVED and already applied to the design
> pack — Q4, Q12 and Q14 below reflect it.**

## The one that decides the build order

| # | Question | Recommended | Why (one line) |
|---|---|---|---|
| Q14 | First launch slice? | **1. Executive Dashboard (customisable per user — widgets, layouts, UI prefs, decision 20) → 2. Connections (Slack first) → 3. AI agent** — Phase 1 also includes thin Slack + GitHub (post to Slack, link PRs, commit → ticket) and Jira/ClickUp import (feature rework, approved 2026-11-17) | This is already the pitch roadmap (Phases 1–3). Dashboard proves the reporting engine, Slack fixes the deal-loser, AI comes once real data exists. Import is what makes switching possible. |

## The two that decide the pitch numbers

| # | Question | Recommended | Why (one line) |
|---|---|---|---|
| Q1 | Plans & pricing? | **Keep the pitch tiers: Starter $8, Growth $15, Business $25 / user / month, Enterprise custom, 14-day free trial** — validate with the pilot customer before launch | The pitch doc (16 pages, `agilytics-os-investor-pitch.pdf`, 2026-11-17) already prints these as "proposed, to validate". Changing them means re-issuing the pitch. |
| Q2 | AWS region? | **`ap-south-1` (Mumbai)** | Closest AWS region to Pakistan; there is no Pakistan region. If a pilot customer needs UAE data residency, we switch the Terraform region variable to `me-central-1` then. |

## The rest — safe defaults, approve as a batch

| # | Question | Recommended | Why (one line) |
|---|---|---|---|
| Q3 | MFA / SSO? | **MFA enforced for platform admins only at launch; optional for workspace users. SAML/OIDC SSO later, as an Enterprise feature** | Security where it matters most, no login friction for pilot users. Pitch already lists SSO under Enterprise. |
| Q4 | AI production provider + cap? | **Gemini (paid) as default; $20 / workspace / month default cap, tracked per workspace, adjustable per plan** — free tiers are for dev/demo data only; real pilot data runs on the paid, no-retention provider | Gemini paid is the cheapest production step from the free tier already in the design. Cap stops a runaway bill. Free tiers may train on inputs, so they never carry real client data. |
| Q5 | Realtime Phase 2 timing? | **After first launch** (Phase 1 polling + Notification Inbox first) | Pitch roadmap says the same. Sockets + Redis land in Phase 2, not before the dashboard is proven. |
| Q6 | Notification channels + daily-update reminder? | **Notification Inbox + Slack first; email (SES) only for overdue / blocked. Daily-update reminder 09:00 Asia/Karachi, in-app + Slack when connected** | Slack is where the team already lives; email stays for things that must not be missed. |
| Q7 | Stale threshold? | **Yes — no daily update in 3 days = stale** | Already the number in the design and the pitch. |
| Q8 | Consented support access? | **Do NOT build it. Keep it impossible** | The privacy boundary ("we never see customer work") is strongest as "not built". Revisit only if a paying customer demands it, with explicit consent. |
| Q9 | Switching workspaces (user in several tenants)? | **Workspace switcher at the top of the sidebar** | Standard pattern; one login, switch tenant. |
| Q10 | Observability? | **Sentry for errors + CloudWatch alarms for the API/worker** | Sentry free tier to start; CloudWatch is native to AWS, no extra vendor. |
| Q11 | Export & deletion on churn? | **Export JSON + CSV for tickets; delete workspace data within 30 days of churn** | Covers GDPR export/erasure; 30 days is the usual, defensible SLA. |
| Q12 | Project Docs editor + upload limits? | **Tiptap rich text, re-decided on PM merit (best PM-doc editor, NOT "same as v1"); uploads Starter 5 GB, Growth 20 GB, Business 100 GB per workspace** — docs are Project Docs under a project/ticket/sprint, not a standalone wiki | Feature rework (approved 2026-11-17): Doc Hub wiki was cut. Limits are proposals tied to the Q1 tiers. |
| Q13 | Mobile? | **Desktop web only for launch; responsive mobile web, no native app** | Pilot buyers are software houses on desktop. Native app is a later decision. |

## How to answer (copy-paste)

- `yes to all — approved, start the overnight build`
- or e.g. `yes except Q4 cap $50, Q2 keep Mumbai, Q13 mobile web matters — change that one`
- or `change Q14: Connections first, Dashboard second` — and the build order flips to match.

## What happens after you approve

1. First commit pushed to `hasnainali567/agilytics-os` (`main`).
2. Overnight build in the Q14 order above, no disturbance.
3. Preview links (Vercel) sent with each finished slice — you check the product in the browser, no pull/run needed.
4. Pitch numbers stay as in the PDF unless you change Q1/Q14 here.
