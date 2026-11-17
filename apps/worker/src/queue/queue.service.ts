import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import type { Job } from "../jobs/jobs.service";

/** SQS queue client — the API enqueues, the worker consumes. No Redis/BullMQ. */
@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private readonly client: SQSClient;

  constructor(private readonly config: ConfigService) {
    this.client = new SQSClient({ region: config.get<string>("COGNITO_REGION") ?? "ap-south-1" });
  }

  async enqueue(job: Job): Promise<void> {
    const queueUrl = this.config.get<string>("SQS_JOBS_QUEUE_URL");
    if (!queueUrl) {
      this.logger.log(`No SQS queue configured — job ${job.type} dropped (dev stub)`);
      return;
    }
    await this.client.send(
      new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: JSON.stringify(job) }),
    );
  }
}
