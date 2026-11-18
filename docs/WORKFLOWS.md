# Daily Updates + Custom Workflows

Two decisions, locked 2026-11-17. Both replace a v1 limitation: comments
could not show a task's state or track a person, and boards were locked to
3 fixed statuses (Pending / Progress / Done).

## 1. Daily Updates — the record of "what is happening"

Comments are discussion. They cannot answer "what is the state of this
task right now?" or "who is actually progressing?". Daily Updates can.

### Model — `DailyUpdate`

One row per **member per ticket per day** (upsert on
`[ticketId, memberId, date]`):

| Field             | Meaning                                              |
| ----------------- | ---------------------------------------------------- |
| `date`            | Calendar day (UTC) the update is for                 |
| `doneToday`       | What was done today (required, free text)            |
| `next`            | What is next (optional)                              |
| `blockers`        | Blocker detail (free text, optional)                 |
| `hasBlocker`      | Linked blocker flag — the ticket has an open blocker |
| `progressPercent` | 0–100 (optional)                                     |
| `health`          | `ON_TRACK` / `AT_RISK` / `BLOCKED` (confidence)      |
| `timeSpentMin`    | Time spent, minutes (optional)                       |

### API — `apps/api/src/modules/daily-updates/`

- `POST /tickets/:ticketId/daily-updates` — create or update **today's**
  update for the calling member (upsert; posting twice in a day edits,
  never duplicates).
- `GET /tickets/:ticketId/daily-updates` — timeline on one ticket,
  newest first.
- `GET /daily-updates/today` — who updated today, who did not, and
  today's open blockers.
- `GET /daily-updates/blockers?projectId=` — open blockers across a
  project or the whole workspace (latest blocker-flagged update per
  ticket).

### Frontend

- **Daily Update composer** on the ticket board
  (`components/DailyUpdateComposer.tsx`): pick a ticket, write what was
  done / what is next, blockers, progress %, health, time spent.
  **Burden control:** a 2-minute form, pre-filled from yesterday's
  update + linked GitHub activity — or people will stop doing it.
- **Today / My Work on Home:** My Work first (assigned to me, due
  today/overdue, blocked, mentioned, my updates due), then the team
  Today feed (who updated / who is silent / open blockers / stale
  tickets). Home is **not** a social feed.
- **Per-person day view:** one person's updates across their tickets
  today — not only per-ticket timelines.

### What derives from updates (never from comments)

- **Stale-ticket detection** — a ticket not in a DONE-category column
  with no daily update in 3+ days (see `reporting.service.ts`,
  `STALE_AFTER_DAYS = 3`). Reported as **silent / stale tracking**, not
  "quiet-member detection" (that name is cut — it read as surveillance).
- **Blocker lists** — per project and per workspace. Blockers are
  actionable: `TicketLink` (BLOCKS / BLOCKED_BY) shows _what_ is
  blocking a ticket, not just a flag.
- **Per-person tracking** — who updated today, who is silent, who is
  repeatedly blocked.
- **Velocity / progress trends** — progress % and done movement over
  time, read together with status history.
- **Time tracking** — `timeSpentMin` on an update writes to `TimeEntry`
  (one source, not two); totals per ticket / sprint / project.

## 2. Custom workflows — statuses owned by the company, not by us

### Models — `Board`, `BoardColumn`

- A project has **MANY boards** (e.g. Engineering, Design, Ops).
- A board has **unlimited columns**, defined by the workspace admin:
  - `name` — free text, **no restrictions**.
  - `order` — admin-defined position.
  - `colour` — admin-defined.
  - `category` — `TODO` / `IN_PROGRESS` / `DONE`. This is the **only**
    thing reporting reads. The name is display; the category is meaning.
- `Ticket.status` is a **BoardColumn id** (`statusId`), not an enum.
  There is deliberately **no fixed status enum in v2** — the old
  `TicketStatus` enum (TODO / IN_PROGRESS / IN_REVIEW / DONE / BLOCKED)
  was deleted from the schema and the shared contracts.
- A column may carry an **optional WIP limit** (`BoardColumn.wipLimit`,
  null = no limit) — standard Kanban.
- A ticket with no `statusId` is **unplaced** — it shows in its own
  column on the board, never silently dropped from counts.

### Default template (starting point only)

On project creation the API creates a default board from
`DEFAULT_BOARD_TEMPLATE` (`@agilytics/shared`):

Backlog (todo) → To Do (todo) → In Progress (in-progress) → Review
(in-progress) → Done (done).

It is a starting point, **fully editable** — rename, reorder, add,
remove anything.

### Who can change workflows

The **workspace admin / company head** — Membership role `OWNER` or
`ADMIN` — through the API (`/boards/…`) and the Workflow settings page
(`/settings/workflows`). **Not the platform admin**: platform admins
govern tenants, never a tenant's own workflow. Every mutation checks
the caller's membership role in `BoardsService`.

### API — `apps/api/src/modules/boards/`

- `GET /boards?projectId=` — boards with columns (ordered).
- `POST /boards` — create a board (starts from the default template).
- `POST /boards/:id/columns` — add a column.
- `PATCH /boards/:boardId/columns/:columnId` — rename / reorder /
  recolour / re-categorise.
- `DELETE /boards/:boardId/columns/:columnId` — remove a column; its
  tickets move to `moveTicketsToColumnId` or become unplaced. Tickets
  are never deleted with a column.
- `DELETE /boards/:id` — remove a board (the default board cannot be
  deleted; changing the default is not implemented yet).

### Status history — why custom names still report correctly

`TicketStatusHistory` records **every** status change with
`fromStatusId`, `toStatusId`, `changedById` (who) and `createdAt`
(when). Status changes go through `TicketsService.changeStatus` only —
never a direct update — so history is complete. Dashboards compute
from history + column categories, never from names:

- **Time-in-status** — between consecutive history rows.
- **Cycle time** — first entry into an IN_PROGRESS-category column to
  first entry into a DONE-category column.
- **Velocity** — points entering a DONE-category column per week.
- **Stale tickets** — no daily update in 3+ days while not done.
- **Reopen rate** — DONE → non-DONE transitions.

## 3. What is NOT built yet

- Workflow settings edit UI (rename/reorder/add/remove from the page —
  the page is read-only; mutations are API-only for now).
- Changing the default board.
- Board templates beyond the one default (per-team templates).
- Daily-update reminders (nudge members who are silent — a worker job).
- Progress-% rollups per sprint/project on the dashboard (trends read
  the same tables; the chart is not drawn yet).
