# Frontend architecture — Agilytics OS web app

## 1. Shape

- **Vite SPA, React 19 + TypeScript strict.** The whole app sits behind a
  login, so there is no SSR and no SEO — no Next.js. The API is
  server-by-default; the web is thin client islands over it.
- **Design system — Kanban board design ("Creating an application for
  aero.com", locked 2026-11-19, decision 25).** The Kanban board image
  Jhon shared is THE design for the whole product; Pin 3 (DealDeck)
  is the Reports layout (§1D). Pin 5 stays the Connections toggles
  pattern. Full tokens, rail spec, top bar,
  header and grid mappings, and component rules: §1A below.
  **Superseded:** Pin 1 Employee Management Dashboard — it was THE
  design for a few hours on 2026-11-19 and was superseded the same
  day by this Kanban design (decision 25); kept only as history in
  DESIGN-DECISIONS.md #23. Also superseded: the Agibankz banking
  design (2026-11-17 → 2026-11-19) — mapping a banking UI onto a PM
  app is not feasible; lime/forest tokens are removed from the code
  and kept only as history in DESIGN-DECISIONS.md #19. Also
  superseded: the dark navy sidebar / white canvas / deep-blue
  primary direction.
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
  user** — widget visibility only (§1B), Kanban theme fixed. Layout is
  fixed; there is no drag/resize (decision 24).
- **Roadmap / Timeline view (Phase 2):** epics + sprints on a date
  axis; Calendar view from due dates.
- **Rules that keep the v1 mess out:** small files (~150 lines), one
  component per file, reuse-before-create, shared dashboard primitives
  only — no hand-rolled panels per route, no 25KB monolithic sidebar.
  (The icon rail + top nav in §1A are one shared shell component, not
  per-route navigation.)

### 1A. Design system — Kanban board design (THE design, locked 2026-11-19, decision 25)

Source: the Kanban board image Jhon shared ("Creating an application
for aero.com"). This is a UI designed for the product being built (a
project-management board app), so its layout, palette and patterns
map to Agilytics directly — unlike the superseded Agibankz banking
pin. Hex values are close visual estimates from the image and are
labelled `~`; the Tailwind theme in `apps/web/src/index.css` is the
single source of truth.

**History (one line):** Pin 1 Employee Management Dashboard
(`https://au.pinterest.com/pin/1101693127633567775/`) was THE design
for a few hours on 2026-11-19 and was superseded the same day by
this Kanban design (decision 25); its tokens are kept only as
history in DESIGN-DECISIONS.md #23 — do not build to them.

#### Tokens

| Token                  | Value                    | Use                                      |
| ---------------------- | ------------------------ | ---------------------------------------- |
| Page background        | Very light blue-grey `#E9EEF5` | Page canvas                        |
| Cards                  | `#FFFFFF`                | All cards                                |
| Primary vivid purple   | `#6C5CE7`                | Create button, primary actions, active states |
| Near-black             | `#111827`                | Headings, values, body text              |
| Accent light           | `#EFEAFE`                | Purple accent fills                      |
| Green                  | `#22C55E`                | New pill, done / positive                |
| Pastel tags            | Soft pastel fills (lavender, mint, peach, sky) | Tag chips on cards |
| Positive green         | `#22C55E` on `#DCFCE7`   | Done / positive trends, with explicit `+`|
| Negative red           | `#EF4444` on `#FEE2E2`   | At-risk / negative trends, with `−`      |
| Orange accent          | `#F59E0B` on `#FEF3C7`   | Warnings / targets                       |
| Muted text             | `#6B7280`                | Body secondary                           |
| Inactive nav           | `#94A3B8`                | Unselected nav items                     |
| Borders / dividers     | `#E5E7EB`                | Card borders, dividers, tracks           |
| Neutral pill           | `#F2F3F7`                | Neutral pill / chip background           |

Status colours are used only for meaning (done green, in-progress
purple accent, blocked/at-risk red, amber/orange for warnings) — never as
decoration. Trends always carry an explicit `+` or `−` sign with the
colour, never colour alone.

#### Typography

Inter (loaded via Google Fonts). No serif anywhere.

| Element       | Size / weight            |
| ------------- | ------------------------ |
| Page heading  | 20–24px, weight 700      |
| Section title | 14–16px, weight 600      |
| KPI label     | 11–12px, grey            |
| KPI number    | 20–24px, weight 700      |
| Body / table  | 12–13px, weight 400–500  |
| Status pills  | 11–12px, weight 500      |

#### Corners, spacing, elevation

- **Corners:** large cards 16–20px; inner blocks ~12px; pills
  (nav pills, date pill, status pills) `999px`; buttons 10–12px;
  icon tiles / avatars 50% circles.
- **Spacing:** outer padding ~16–24px; gutters 16–20px; card
  padding 16–24px; section gaps ~16px; list rows 12–16px.
- **Elevation:** white cards, flat with a very soft shadow + 1px
  `#E5E7EB` border. No gradients, no glass, no dark surfaces.

#### Shell — thin icon rail + dropdown top bar

The design has NO wide labelled sidebar. Agilytics keeps exactly
its shell:

- **Thin vertical icon rail** on the far left (64px), fixed
  full-height; only the content column scrolls. User avatar at the
  top, then a **MENU** group (icon-only nav: Dashboard, Projects,
  Boards, Sprints, Members, Reports, Inbox, Connections, Workflows,
  Roles, Admin), then an **APPS** group for the connected
  integrations (Slack, GitHub, Notion, Google), and a theme toggle
  at the bottom. Active rail icon: vivid purple `#6C5CE7`
  filled/highlighted square.
- **Top bar:** **Your work / Projects / Filters / Dashboards**
  dropdowns on the left; a purple **Create** button and a **Voice
  search** pill; search, messages, bell and settings icons at the
  right. The messages icon links to `/inbox` for now — team chat is
  a future idea, not built (decision 26).
- **Header row:** breadcrumb (`Projects / {project} / {board}`) above
  a big bold page title on the left; member avatar stack + Invite
  action and a view switcher on the right.

#### Content grid (adapted — PM content, never HR/banking content)

- **Row 1:** 4 KPI cards in one row (sprint velocity / tickets done /
  members at risk / open blockers), each with a tinted icon tile
  top-left and a small delta.
- **Row 2:** wide card left + narrower column right (Today feed /
  board summary wide; events / blockers narrow).
- **Row 3:** wide table left + narrower card right (tickets or
  members table wide; workload or sprint summary narrow).
- The Reports page follows Pin 3 instead — see §1D.

#### Buttons and components

- **Primary:** vivid purple `#6C5CE7` filled button, 10–12px radius.
- **Secondary:** white outlined button, 10–12px radius.
- **Nav:** rail icons with a purple `#6C5CE7` active state; top-bar
  dropdowns for Your work / Projects / Filters / Dashboards.
- **Icons:** thin line icons (Lucide), 17px in nav.
- **Inputs:** premium Apple-like custom inputs (16px radius,
  warm-white, hairline border deepening on hover, soft purple
  `#6C5CE7` focus glow, no native controls) — focus uses the
  vivid purple accent.
- **Shared primitives** (`Card`, `StatusPill`, `Button`, `Input`,
  `Select`, `Textarea`, `Field` in `components/ui.tsx`) are the only
  way to build a surface; any component that does not match this
  section is wrong by definition and gets fixed before ship.

#### Board — Kanban design (locked 2026-11-19, decision 25)

The board is the main Kanban design applied to a Kanban surface:

- **Project header:** breadcrumb (`Projects / {project} / {board}`)
  on the left, member avatar stack + an Invite action on the right,
  above the columns. Project/board pickers stay in the card below
  the header.
- **Column headers:** a coloured pill per status — the status colour
  as the pill fill/dot, status name, ticket count and total hours
  (`{count} · {hours}h`). Columns come from the board's custom
  workflow, never a fixed status list.
- **Task cards:** rich white cards — ticket key, title, priority,
  estimate, assignee avatar and time logged — built from the same
  `Card` primitive, 12px inner radius, hairline `#E5E7EB` border.
  Selected card: vivid purple `#6C5CE7` border on an accent-light fill.
- **APPS rail group:** the icon rail carries an APPS group for the
  connected integrations (Slack, GitHub, Notion, Google), below the
  main nav and above Workflows / Roles / Admin.
- **Interaction:** drag-to-move (dnd-kit — the dashboard does NOT
  use it, the board does) PATCHes the ticket's status; a keyboard
  move-to-column menu is the alternative. Unplaced tickets (no
  column yet) sit in their own non-droppable column; clicking a
  ticket opens its detail panel below the board.

Status note: the board page already implements the colour-dot column
headers with counts and the key / title / priority / estimate card.
The breadcrumb + member-stack + Invite project header, hours in the
column headers, and the APPS rail group are the remaining board-slice
work — they are the design target above, not yet in the code.

### 1B. Customisable Dashboard + UI (locked 2026-11-17, decision 20; layout editing superseded 2026-11-19, decision 24)

**Phase 1, with the Executive Dashboard.** Customisation is what makes
the dashboard feel like _my_ dashboard — and it is per **user**, not
per workspace. The company's workflow (boards, statuses, reporting
categories) stays shared; the view is personal.

**Dashboard — fixed layout, visibility only.** The grid is a
FIXED structure: 4 KPI cards in one row, then wide (8) + narrow (4)
rows (Velocity + Today feed, Blockers + Workload, At-risk + My Work,
AI brief full width). There is NO drag-to-swap, NO resize, NO drag
handles, NO layout editing — that part of decision 20 is superseded
by decision 24. What the user CAN customise is **what they see**: a
"Customise" panel with one checkbox/toggle per widget (KPI, velocity,
workload, Today feed, blockers, at-risk, My Work, AI brief) to
add/remove it. The saved widget list IS the visible set, stored per
user via the existing `PUT /dashboard/layout` (no API contract
change). Each widget's content is still configurable in a widget
config panel: which stats it shows, which project / sprint / team it
pulls from, and its time range. A widget with no data for its scope
renders an empty state, never another widget's data.

**Widget registry.** One component per widget type, all built from the
shared primitives in §1A (so the dashboard still looks like
Agilytics):

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

**Saved visibility, per user.** Visibility is saved to the API
(`DashboardLayout`, see `SYSTEM-DESIGN.md` §4) and **auto-saved** on
every change (debounced), **synced across devices** on login, and
**reset to default in one click** (`POST /dashboard/layout/reset`).
**Role templates** seed a new user's first layout — Manager, Lead,
Developer, Viewer — each a preset widget set; after that the visible
set is the user's own.

**UI customisation (same rule: per user, not per workspace).**
Density (**comfortable / compact**) and **which nav items are shown**
(hide a section you never use; hiding a nav item never hides the
data — the route still exists). UI preferences travel with the layout
record (the `ui` block in the layout JSON) so they sync across
devices too, and they live in Zustand only as a cache of the server
record — never as the source of truth.

**What customisation is NOT.** The Kanban theme stays the system.
Users do **not** pick colours, skins, fonts or themes — customisation
is _what you see_, not re-skinning. The tokens in §1A are not
user-configurable.

**The reporting engine underneath never changes.** Widgets read the
same reporting aggregates (`GET /reporting/dashboard-summary` and the
widget's scoped query) that the fixed dashboard and the generated
weekly reports read. A custom dashboard can therefore never break a
report: it filters the presentation, it never changes a definition, a
category, or a number. If a widget's scope is deleted (e.g. a project
is archived), the widget falls back to an empty state with a
"re-pick scope" action.

**Implementation:** widget registry in `features/dashboard/widgets/`
(one file per widget, registered by type); fixed grid in
`DashboardGrid.tsx` (no dnd-kit on the dashboard — dnd-kit stays as
a dependency because TicketBoard uses it); visibility state in
TanStack Query keyed `["dashboard-layout", tenantId, userId]` with
optimistic updates and a debounced `PUT /dashboard/layout`; config
panel as a side sheet, not a modal, so the user sees the widget
change live.

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

### 1D. Reports — Pin 3 DealDeck (locked 2026-11-19, decision 23; confirmed by decision 25)

Source: DealDeck Sales Report pin,
`https://au.pinterest.com/pin/1090011916101914285/`. Reports only.

- **Page bg** pale lavender-grey `#E9EBF3`; cards white, 20px radius,
  1px `#E5E7EB` border, very soft shadow.
- **Accent** royal blue `#3B5BFF` — filled KPI card, bars, donut
  rings. Other accents follow §1A (green `#22C55E` on `#DCFCE7`,
  red `#EF4444` on `#FEE2E2`, grey series `#CBD5E1`).
- **2×2 KPI block:** ONE filled royal-blue card (white text) + 3
  white cards; each with a tinted icon square top-left and a
  green/red delta pill top-right. KPIs are PM content: tickets done /
  velocity / members active / overdue.
- **Charts:** multi-ring donut (tickets by status, centre total +
  legend below the chart) and a grouped vertical bar chart
  (velocity per sprint: done vs planned, grey vs blue series).
- **Type:** section titles 15–17px bold with 11–12px grey subtitles.
- The pin's own sales content is never shown — every section is
  adapted to PM content (projects, sprints, tickets, members, daily
  updates, time).

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
- Virtualised lists, memoised chart pass, full a11y audit.
- Playwright e2e (installed, browsers not downloaded in this sandbox).
- Board cards do not show checklists, file counts, or tag pills:
  the API has no checklist / attachment / label fields on tickets,
  so cards show only real fields (title, priority, assignee,
  estimate, due date, status). Adding them needs an API/schema
  addition, not a frontend restyle.
- Team chat (decision 26) and the AI agent UI beyond the AI brief
  slot (Phase 3).
- The theme toggle only darkens the page backdrop; a full dark
  theme is not safe yet (many surfaces use literal `bg-white` with
  token text colours).
