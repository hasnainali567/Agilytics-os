import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AiService } from "./ai/ai.service";
import { JobsService } from "./jobs/jobs.service";
import { SweepSchedulerService } from "./jobs/sweep-scheduler.service";
import { QueueService } from "./queue/queue.service";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [JobsService, QueueService, AiService, SweepSchedulerService],
})
export class WorkerModule {}
