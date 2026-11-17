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
    this.logger.log(`Processing job ${job.type} for tenant ${job.tenantId} (stub — no-op)`);
  }
}
