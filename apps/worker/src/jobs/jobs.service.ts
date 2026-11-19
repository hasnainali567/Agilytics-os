import { Injectable, Logger } from "@nestjs/common";

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

  async process(job: Job): Promise<void> {
    // [worker-b: automations] `automation.run` — overdue sweep stub.
    // The worker has no Prisma/DB access in this slice, so it cannot
    // run the sweep itself. The real path is the API endpoint
    // POST /api/v1/integrations/automations/sweep (workspace-admin
    // guarded, AUTOMATIONS_MANAGE): the scheduler / a cron enqueues
    // this job per tenant, and the handler below calls that endpoint.
    // TODO: wire an HTTP call to the API sweep endpoint here once the
    // worker has an API base URL + a service credential; until then
    // the sweep runs when an admin presses "Run overdue sweep" in the
    // Connections page (or any scheduled caller hits the endpoint).
    if (job.type === "automation.run") {
      this.logger.log(
        `automation.run for tenant ${job.tenantId}: sweep endpoint is POST /api/v1/integrations/automations/sweep — no API caller wired in the worker yet (TODO above)`,
      );
      return;
    }
    this.logger.log(`Processing job ${job.type} for tenant ${job.tenantId} (stub — no-op)`);
  }
}
