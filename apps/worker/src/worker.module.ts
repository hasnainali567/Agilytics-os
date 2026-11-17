import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AiService } from "./ai/ai.service";
import { JobsService } from "./jobs/jobs.service";
import { QueueService } from "./queue/queue.service";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [JobsService, QueueService, AiService],
})
export class WorkerModule {}
