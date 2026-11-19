# Worker — Agilytics OS v2

Standalone NestJS application context (no HTTP server). Consumes async jobs
from SQS: AI summaries, integration syncs, notification digests, automation
actions. The API only enqueues jobs; it never does slow work in a request.

## Run

```bash
pnpm dev    # watch mode
pnpm build  # nest build
pnpm start  # node dist/main.js
```

Current state: the SQS consumer is a stub (`src/jobs/jobs.service.ts` logs
and acknowledges). Real handlers land with the first real job — AI weekly
summary first.

## Overdue sweep scheduler

`src/jobs/sweep-scheduler.service.ts` runs the overdue sweep on an
in-process interval (default every 15 minutes): it POSTs the API endpoint
`POST /api/v1/integrations/automations/sweep`. The `automation.run` job
delegates to the same call. Config: `SWEEP_API_BASE_URL` (default
`http://localhost:3001`), `SWEEP_INTERVAL_MS` (default `900000`),
`SWEEP_ENABLED`, and `SWEEP_API_TOKEN` — a JWT for a service user with
`AUTOMATIONS_MANAGE` in the tenant to sweep. Without the token the
scheduler logs a warning and stays off; the endpoint's auth is never
weakened. Production replaces the interval with SQS / EventBridge (see
`docs/INTEGRATIONS.md` § Automations).
