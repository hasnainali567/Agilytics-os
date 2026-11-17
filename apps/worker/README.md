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
