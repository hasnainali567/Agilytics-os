import { Injectable, Logger, Optional } from "@nestjs/common";
import { SweepSchedulerService } from "./sweep-scheduler.service";

export type JobType = "ai.summary" | "integration.sync" | "notification.digest" | "automation.run";

export interface Job {
  type: JobType;
  tenantId: string;
  payload: Record<string, unknown>;
}

/** Stub job processor — logs and acknowledges. Real handlers land per job type. */
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(@Optional() private readonly sweepScheduler?: SweepSchedulerService) {}

  async process(job: Job): Promise<void> {
    // [worker-b: automations] `automation.run` — overdue sweep.
    // Delegates to SweepSchedulerService, which POSTs the API endpoint
    // POST /api/v1/integrations/automations/sweep (workspace-admin
    // guarded, AUTOMATIONS_MANAGE). The worker has no Prisma/DB access
    // in this slice, so it cannot run the sweep itself. Without
    // SWEEP_API_TOKEN the scheduler logs the gap and skips — the sweep
    // then only runs when an admin presses "Run overdue sweep" in the
    // Connections page. See SweepSchedulerService for the auth gap note.
    if (job.type === "automation.run") {
      const result = await this.sweepScheduler?.runSweepOnce();
      this.logger.log(
        `automation.run for tenant ${job.tenantId}: sweep ${result?.ok ? "ok" : "not run"} ` +
          `(${result?.skipped ?? result?.error ?? `HTTP ${result?.status ?? "?"}`})`,
      );
      return;
    }
    this.logger.log(`Processing job ${job.type} for tenant ${job.tenantId} (stub — no-op)`);
  }
}
