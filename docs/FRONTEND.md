# Frontend architecture — Agilytics OS web app

## 1. Shape

- **Vite SPA, React 19 + TypeScript strict.** The whole app sits behind a
  login, so there is no SSR and no SEO — no Next.js. The API is
  server-by-default; the web is thin client islands over it.
- **Design system — Agibankz (locked 2026-11-17, decision 19).**
  The Agibankz Web Banking Dashboard pin
  (`https://www.pinterest.com/pin/834151162281618403/`, Delibix) is THE
  design for the whole product. Pin 1 (Employee Dashboard) is demoted to a
  supporting reference only (its KPI cards / member table are still useful
  patterns); Pin 3 (DealDeck) stays the Reports layout; Pin 5 stays the
  Connections toggles pattern. Full tokens, sidebar spec, hero and
  bottom-column mappings, and component rules: §1A below. **Superseded:**
  the old direction — dark navy sidebar, white canvas, deep-blue primary —
  is no longer the design; do not use it anywhere new.
- **Home is Today / My Work first, not a social feed.** Top of Home:
  My Work (assigned to me, due today/overdue, blocked, mentioned, my
  Daily Updates due), then the team Today feed (who updated / silent /
  open blockers / stale tickets). No activity-feed-as-social-feed shape.
- **Tickets have List / Table view as well as Board view**, with bulk
  edit + saved filters. Jira/ClickUp users live in lists as much as
  boards.
- **Notification Inbox (Phase 1):** one list, read/unread, filter by
  mention / assignment / blocker / automation.
- **Dashboard:** KPI cards + velocity, CFD, cycle time, throughput,
  WIP, workload, **sprint burndown**, **time-in-status**, health badges
  computed from Daily Updates + blockers + stale with a written rule,
  and a My Work strip on top. **The dashboard is customisable per
  user** — widgets, layout, and UI prefs (§1B), Agibankz theme fixed.
- **Roadmap / Timeline view (Phase 2):** epics + sprints on a date
  axis; Calendar view from due dates.
- **Rules that keep the v1 mess out:** small files (~150 lines), one
  component per file, reuse-before-create, shared dashboard primitives
  only — no hand-rolled panels per route, no 25KB monolithic sidebar.
  (The Agibankz sidebar in §1A is one shared shell component, not a
  per-route sidebar.)

### 1A. Design system — Agibankz (THE design, locked 2026-11-17)

Source: Agibankz Web Banking Dashboard by Delibix,
`https://www.pinterest.com/pin/834151162281618403/`. Follow the same
colour theme, fonts, corners, spacing, aesthetic and vibe — fresh,
playful, airy, rounded-everything, lime pop on white, credible not
corporate. The product must feel fresh while looking at it and make
team members feel good, with extreme good UX. Hex values are close
visual estimates from the flat pin image and are labelled `~` in this
doc; the build must pin exact values in the Tailwind theme and treat
them as the single source of truth.

**IMPORTANT CORRECTION — no dark hero card.** There is NO dark hero
card in this pin. The hero is a two-card split: a white card (57%) +
a bright lime card (43%). Do NOT describe or build a dark hero card
anywhere in this product.

#### Tokens

| Token                      | Value                                  | Use                                                                                                                              |
| -------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| App background             | `~#F4F4F2` warm off-white              | Page canvas                                                                                                                      |
| Cards                      | `#FFFFFF`                              | All cards                                                                                                                        |
| Outer canvas               | `~#E8E8E8`                             | Shell behind the app background                                                                                                  |
| Primary accent lime        | `~#A9E85C` (range `#A3E635`–`#B1F06A`) | Hero highlight card, active nav state, key accents                                                                               |
| Lighter lime sub-cards     | `~#C0EE7E`                             | Sub-cards inside the lime hero card                                                                                              |
| Deeper lime                | `~#A3E635`                             | Donut / progress fills                                                                                                           |
| Deep forest green          | `~#0F3D20` (range `#0E3B1F`–`#123F22`) | **Primary dark/action colour — use ONLY for the primary button, PRIORITY-style pills and % badges.** Never as a page background. |
| Primary text               | `~#111211` near-black                  | Headings, hero numbers, values                                                                                                   |
| Secondary / muted text     | `~#8A8F8A`                             | Body secondary, chart labels                                                                                                     |
| Small labels               | `~#7A7F7A`                             | Section labels                                                                                                                   |
| Inactive nav               | `~#9AA09A`                             | Unselected nav items                                                                                                             |
| Borders / dividers / track | `~#E5E7E5`–`#E8EAE8`                   | Card borders, dividers, progress tracks                                                                                          |
| Donut track                | `~#E3E6E3`                             | Donut background ring                                                                                                            |
| Pill background            | `~#F0F0EE`                             | Neutral pill / chip background                                                                                                   |
| Positive green             | `~#1FA463`                             | Done / positive trends, with explicit `+`                                                                                        |
| Negative red               | `~#E5484D`                             | At-risk / negative trends, with explicit `−`                                                                                     |
| Orange accent              | `~#FF6A2B` / `~#F96D2E`                | Targets, confirmations, highlights                                                                                               |
| Notification dot           | `~#FF3B30`                             | Unread dot                                                                                                                       |

Status colours are used only for meaning (done green, in-progress lime/
forest, blocked/at-risk red, amber/orange for warnings) — never as
decoration. Trends always carry an explicit `+` or `−` sign with the
colour, never colour alone.

#### Typography

Geometric / humanist sans, closest to Inter / Plus Jakarta Sans /
Poppins. No serif anywhere.

| Element      | Size / weight                                            |
| ------------ | -------------------------------------------------------- |
| Hero numbers | 52–56px, weight 500–600, tight tracking, tabular figures |
| Card titles  | 18–20px, weight 600                                      |
| Labels       | 13px, weight 500, grey                                   |
| Body         | 14–15px, weight 400–500                                  |
| Micro-labels | 10px, letter-spaced caps                                 |

#### Corners and spacing

- **Corners:** outer shell 24–28px; hero / bottom cards 20–24px;
  inner sub-cards 12–16px; buttons, nav pills, badges and progress
  bars fully pill `999px`; icon chips and avatars 50% circles; donut
  a full circle with a thick stroke.
- **Spacing:** outer padding ~24px; gutters 16–20px; card padding
  20–24px; section gaps ~16px; list rows 12–16px; ~8px label-to-value
  gaps.
- **Elevation:** flat, almost no shadows — only a very soft shadow
  under the outer shell. No gradients, no glass, no dark surfaces.

#### The one addition — left sidebar, in the SAME tokens

The pin has no sidebar; Agilytics adds exactly one: a left sidebar
built from the same tokens, so it feels like the next level of this
design, not a different product. Warm off-white background (`~#F4F4F2`),
white cards, lime (`~#A9E85C`) active state, deep forest green
(`~#0F3D20`) primary, pill nav items (`999px`), 20–24px radii, same
fonts and spacing as the rest of the app.

Sidebar contents, top to bottom: workspace switcher (top), then
Home/Today, Projects, Boards, Sprints, Reports, Doc Hub (Project
Docs), Connections, Automations, AI, Admin — then a user card at the
bottom. Active nav item: lime pill background with forest-green text/
icon. Inactive items: `~#9AA09A` text. Notification dot `~#FF3B30`
on items with unread activity. The sidebar is a single shared shell
component; no route builds its own navigation.

#### Hero pattern (adapted — PM content, never banking content)

Two-card split, same proportions as the pin (white 57% / lime 43%):

- **White card — the main KPI/hero number** (e.g. sprint velocity /
  active work): a huge friendly numeral (52–56px), an eye toggle to
  hide/show it, a dark forest-green filled pill primary button, an
  outlined white pill secondary button, and a big lime circle arrow
  button bottom-right.
- **Lime card — the highlight card** (e.g. AI insight / weekly
  highlight): a dark-green PRIORITY-style pill, a huge number, a white
  pill badge, and two lighter-lime (`~#C0EE7E`) sub-cards inside it.

#### Bottom 3-column pattern (adapted — same layout, PM content)

The pin's Spending donut / Earning progress bars / Transactions list
maps 1:1 to Agilytics as **Workload donut / Velocity progress bars /
Activity feed** — same layout, same components, same radii and
spacing, PM content only, never banking content.

#### Buttons and components

- **Primary:** dark forest-green filled pill (`999px`).
- **Secondary:** white outlined pill (`999px`).
- **Icon action:** lime circle icon-button (50%).
- **Nav:** pill nav with lime active state.
- **Icons:** thin line icons in light-grey circles.
- **Trends:** credits green with explicit `+`, debits red with
  explicit `−` — adapted to PM as done/at-risk trends with the same
  `+`/`−` and colour rules.
- **Shared primitives** (`KpiCard`, `ChartCard`, `HealthBadge`,
  `InsightCallout`, `WorkloadBar`, hero split, donut, progress bars,
  activity rows) are the only way to build a dashboard surface, and
  they all ship in these tokens. Any component that does not match
  this section is wrong by definition and gets fixed before ship.

### 1B. Customisable Dashboard + UI (locked 2026-11-17, decision 20)

**Phase 1, with the Executive Dashboard.** Customisation is what makes
the dashboard feel like _my_ dashboard — and it is per **user**, not
per workspace. The company's workflow (boards, statuses, reporting
categories) stays shared; the view is personal.

**Dashboard builder — every card is a widget.** The widget registry
holds one component per widget type, all built from the shared
primitives in §1A (so a custom dashboard still looks like Agilytics):

| Widget         | Content it shows                                                                    |
| -------------- | ----------------------------------------------------------------------------------- |
| KPI card       | One stat + trend (tickets done, velocity, overdue, at-risk members…)                |
| Velocity chart | Points entering DONE per week, with time range                                      |
| Workload donut | Workload by member / team / status                                                  |
| Today feed     | Who updated / silent / open blockers                                                |
| Blockers list  | Open blockers, by project or sprint                                                 |
| At-risk list   | At-risk tickets / members, from Daily Updates + stale                               |
| My Work        | Assigned to me, due today/overdue, blocked, mentioned                               |
| AI brief       | Daily brief / risk list (Phase 3 data, widget ships in Phase 1 with the brief slot) |

Per user, on a grid: **add** a widget from the registry, **remove**
one, **drag to rearrange**, **resize width/height** (grid units).
Each widget's content is configurable in a **widget config panel**:
which stats it shows, which project / sprint / team it pulls from,
and its time range. A widget with no data for its scope renders an
empty state, never another widget's data.

**Saved layouts, per user.** Layouts are saved to the API
(`DashboardLayout`, see `SYSTEM-DESIGN.md` §4) and **auto-saved** on
every change (debounced), **synced across devices** on login, and
**reset to default in one click** (`POST /dashboard/layout/reset`).
**Role templates** seed a new user's first layout — Manager, Lead,
Developer, Viewer — each a preset arrangement of the same widgets;
after that the layout is the user's own. A user may keep several
named layouts and switch between them.

**UI customisation (same rule: per user, not per workspace).**
Density (**comfortable / compact**), sidebar **collapsed / expanded**,
and **which nav items are shown** (hide a section you never use;
workspace admins cannot force a nav item on a user, and hiding a nav
item never hides the data — the route still exists). UI preferences
travel with the layout record (the `ui` block in the layout JSON) so
they sync across devices too, and they live in Zustand only as a
cache of the server record — never as the source of truth.

**What customisation is NOT.** The Agibankz theme stays the system.
Users do **not** pick colours, skins, fonts or themes — customisation
is _what you see and where_, not re-skinning. The tokens in §1A are
not user-configurable.

**The reporting engine underneath never changes.** Widgets read the
same reporting aggregates (`GET /reporting/dashboard-summary` and the
widget's scoped query) that the fixed dashboard and the generated
weekly reports read. A custom dashboard can therefore never break a
report: it rearranges and filters the presentation, it never changes
a definition, a category, or a number. If a widget's scope is deleted
(e.g. a project is archived), the widget falls back to an empty state
with a "re-pick scope" action.

**Implementation:** widget registry in `features/dashboard/widgets/`
(one file per widget, registered by type); drag/resize grid on
`dnd-kit` (already pinned); layout state in TanStack Query keyed
`["dashboard-layout", tenantId, userId]` with optimistic updates and
a debounced `PUT /dashboard/layout`; config panel as a side sheet,
not a modal, so the user sees the widget change live.

### 1C. Custom Roles & Permissions UI (locked 2026-11-17, decision 21)

**Roles & Permissions settings page** (`/settings/roles`, in
`features/settings/`): visible only to users with `roles.manage` —
anyone else gets a 403 page, not a hidden menu item that leaks the
route. A **matrix**: roles as columns (system roles first, marked
with a SYSTEM badge, then custom roles), permissions as rows grouped
by area (workspace/members, projects, boards, tickets, sprints, daily
updates, docs, reporting, integrations, AI, time — same grouping as
`GET /permissions`). Each cell is a toggle; toggling calls
`PUT /roles/:id/permissions` with the whole set (one save, no
per-click requests, optimistic update with rollback on error).
Above the matrix: create-role action (name + description + optional
colour), and per-role rename/delete actions. Delete is refused by
the API when members use the role — the UI shows how many members
use it and links to reassign them first, instead of a bare error.
**Role assignment** happens on the member invite/edit screen: a role
dropdown listing system + custom roles (with their description, so
an admin picks by meaning, not by name alone). **Hiding is cosmetic:**
the page reads the caller's effective permissions from
`GET /identity/me` and hides actions the user lacks, but the API
guard is the enforcement point — a user who cannot see the page
cannot call its endpoints either.

## 2. Routing — TanStack Router

- **Target (locked): file-based routes with lazy-loaded route chunks.**
  Each route is its own chunk (`lazyRouteComponent`), so the dashboard
  shell loads first and Reports / Admin / Connections load on demand.
- **Current state (scaffold):** code-based route tree in
  `apps/web/src/router.tsx` (`/`, `/reports`, `/projects`, `/sprints`,
  `/members`, `/connections`, `/admin` guarded by `RequirePlatformAdmin`).
  No lazy loading yet — the file-based + lazy migration is the first
  frontend refactor slice once routes grow past this set.
- Routes are typed (`Register.router`); route params carry the workspace
  id, never a bare global id. Deep-linkable filters (board filter, sprint)
  live in search params, not in component state.

## 3. Server state — TanStack Query (the only server-state layer)

- **Query keys are namespaced per scope:** `["dashboard", workspaceId]`,
  `["projects", workspaceId]`, `["tickets", projectId]`,
  `["ticket", ticketId]`, `["sprints", projectId]`. Invalidation is by
  key: a ticket mutation invalidates `["tickets", projectId]` and
  `["dashboard", workspaceId]` — never a global `invalidateQueries()`.
- **Caching:** `staleTime: 30s` by default (see `lib/query-client.ts`);
  refetch on window focus for the dashboard. Mutations use **optimistic
  updates** with rollback on error (board drag-to-move, ticket status).
- **Phase 1 realtime is polling** — the dashboard query refetches on an
  interval (see `docs/REALTIME.md`). No WebSocket in Phase 1.
- Loading / empty / error states are rendered by every page — there is
  no mock-data fallback anywhere in the tree.

## 4. Client state — Zustand (UI state only, never server data)

- Zustand holds **client UI state only**: sidebar collapsed, board
  filters, open modals, connection toggles (see
  `lib/connections-store.ts`). **UI customisation prefs (density,
  sidebar state, visible nav items) are cached in Zustand but owned
  by the server** — they live in the user's `DashboardLayout` record
  (§1B) and sync across devices; Zustand never invents them.
- Server data never lives in Zustand. If it came from the API, it lives
  in TanStack Query; if it is a filter, it lives in the URL or Zustand —
  never both.

## 5. Folder structure

Target layout (feature folders per domain):

```
src/
  routes/            # file-based routes (lazy chunks) — target, see §2
  features/
    projects/        # project list/detail, hooks, components
    tickets/         # board, list view, ticket detail, comments, attachments
    sprints/         # sprint planning, backlog, burndown, velocity
    reports/         # executive dashboard, charts, generated weekly reports
    dashboard/       # customisable dashboard: widget registry, grid, config panel, layouts (§1B)
    settings/        # workspace settings: Workflow settings, Roles & Permissions matrix (§1C), members
    docs/            # project docs (not a wiki)
    notifications/   # notification inbox
    admin/           # platform admin (PLATFORM_ADMIN only)
    integrations/    # connections hub
  shared/            # design-system primitives, hooks, lib
    components/      # Card, Button, Table, Dialog, …
    hooks/
    lib/
  services/          # typed API clients (see §6)
  lib/               # query-client, auth (Amplify), router setup
```

**Current state (scaffold):** flat `pages/` + `components/` + `lib/`
(`HomePage`, `TicketBoardPage`, `ReportsPage`, `AdminPage`,
`ConnectionsPage`). The move to `features/` + `services/` is the same
refactor slice as file-based routes (§2) — do it in one pass, not file
by file.

## 6. API layer — services, not fetch-in-components

- **No direct `fetch` calls in components. Ever.** Components call a
  service function or a Query hook; the service owns the HTTP call, the
  Zod parse, and the error shape.
- **Services are typed API clients built from the shared Zod contracts**
  in `@agilytics/shared` — request/response shapes are validated with
  the same schemas the API uses, so a contract break fails loudly
  instead of rendering wrong data.
- **Current state:** a thin hand-written client in `lib/api.ts`
  (`fetchDashboardSummary`, `fetchAdminOrganisations`) typed via
  `@agilytics/shared`. The `services/` split (one file per domain,
  `services/projects.ts`, `services/tickets.ts`, …) lands with the
  feature-folder migration (§5).
- Auth: Amplify v6 (`lib/auth.ts`); the Cognito JWT is attached by the
  API client, not by pages.

## 7. Performance

- **Route code-splitting** (§2) — one chunk per route, dashboard first.
- **Virtualised long lists/tables** — member tables, ticket lists and
  audit-log tables virtualise rows instead of rendering thousands of DOM
  nodes (add `@tanstack/react-virtual` when the first long list lands;
  not installed yet).
- **Memoised dashboard charts** — Recharts components are memoised and
  fed by stable Query data, so a filter change does not re-render every
  chart.
- **Skeleton loaders** on every Query-driven page (never a blank page,
  never a spinner-only page for the dashboard shell).

## 8. Accessibility

- Keyboard-first: board drag-and-drop has a keyboard alternative
  (move-to-column menu), all dialogs trap focus and return it on close.
- ARIA: status pills, charts and tables expose roles/labels; charts ship
  with a text summary (same numbers as the visual).
- Focus management: route changes move focus to the page heading;
  toasts/announcements use `aria-live`.

## 9. What is NOT built yet

- File-based routes + lazy chunks (§2), `features/` + `services/`
  migration (§5–§6).
- Customisable dashboard (§1B) — widget registry, drag/resize grid,
  per-user layouts — Phase 1, with the Executive Dashboard.
- Virtualised lists, memoised chart pass, full a11y audit.
- WebSocket realtime (Phase 2 — see `docs/REALTIME.md`).
- Playwright e2e (installed, browsers not downloaded in this sandbox).
