# Web — Agilytics OS v2

React 19 + Vite SPA on Vercel. No SSR, no SEO — every page sits behind login.

## Run

```bash
pnpm dev        # :5173
pnpm build      # tsc + vite build
pnpm test       # vitest
```

## Design — Agibankz (locked, decision 19)

The design is the Agibankz Web Banking Dashboard pin by Delibix
(`https://www.pinterest.com/pin/834151162281618403/`): warm off-white
canvas (`#F4F4F2`), white cards, lime accent (`#A9E85C`), deep forest
green (`#0F3D20`) as the primary action colour only, near-black text
(`#111211`), muted grey (`#8A8F8A`), positive `#1FA463`, negative
`#E5484D`, orange `#FF6A2B`. Geometric sans (Inter / Plus Jakarta Sans /
Poppins). Radii: shell 24–28px, cards 20–24px, inner 12–16px, buttons /
nav / badges / progress fully pill (`999px`). Flat, almost no shadows;
no gradients, no glass, no dark surfaces.

**There is no dark hero card.** The hero is a white main-KPI card
(57%) + a bright lime highlight card (43%). The old direction — dark
navy sidebar, white canvas, deep-blue primary — is superseded; do not
use it anywhere new. Tokens live in `src/index.css` (`@theme`) and are
the single source of truth. The theme is fixed: users do not pick
colours, skins, fonts or themes (decision 20).

## Executive Dashboard + customisation (decision 20, Phase 1)

`src/pages/HomePage.tsx` is the Executive Dashboard: hero split
(white main KPI + lime highlight), then the bottom 3 columns —
Workload donut / Velocity progress bars / Activity feed — all from
`GET /api/v1/reporting/dashboard-summary`. No mock data anywhere.

Every dashboard card is a widget from the registry in
`src/features/dashboard/` (one file per widget: KPI card, velocity
chart, workload donut, Today feed, blockers, at-risk list, My Work,
AI brief stub). Per user, on a 12-column grid: add, remove, drag to
rearrange (dnd-kit core; arrow buttons are the keyboard alternative),
resize width/height in grid units, and configure each widget (stats,
project / sprint / team scope, time range) in a side-sheet config
panel. Layouts are saved to `GET/PUT /dashboard/layout` and
`POST /dashboard/layout/reset` (`DashboardLayout`, per user, tenant-
scoped, auto-saved debounced, synced across devices), seeded from a
role template (Manager / Lead / Developer / Viewer) on first use.
UI prefs (density comfortable/compact, sidebar collapsed/expanded,
visible nav items) travel in the layout record's `ui` block.

A widget with no data for its scope renders an empty state, never
another widget's data. The AI brief widget ships in Phase 1 as the
brief slot only — its data lands in Phase 3.

## Notes

- `VITE_API_URL` points at the NestJS API (default `http://localhost:3001/api/v1`).
- Server state lives in TanStack Query only; UI prefs are cached in
  Zustand but owned by the server layout record.
- The Sidebar / TopBar (`src/components/layout.tsx`) and the shared
  `Button` (`src/components/ui.tsx`) still use the old token names;
  `index.css` maps those names onto Agibankz values as deprecated
  compatibility aliases until those files are migrated.
