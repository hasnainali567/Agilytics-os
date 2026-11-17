# Web — Agilytics OS v2

React 19 + Vite SPA on Vercel. No SSR, no SEO — every page sits behind login.

## Run

```bash
pnpm dev        # :5173
pnpm build      # tsc + vite build
pnpm test       # vitest
```

## Notes

- Design tokens are in `src/index.css` (dark navy sidebar, white canvas,
  deep-blue primary, status colours only for meaning).
- The Home dashboard currently renders **mock data** (`src/lib/mock-data.ts`)
  through TanStack Query, so the component shape already matches the future
  `GET /api/v1/dashboard/summary` call. Replace the `queryFn` in
  `src/pages/HomePage.tsx` when the API lands.
- `VITE_API_URL` points at the NestJS API (default `http://localhost:3001/api/v1`).
