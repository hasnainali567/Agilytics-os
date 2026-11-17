import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { WorkerModule } from "./worker.module";

/**
 * Worker — standalone NestJS application context, no HTTP server.
 * Consumes jobs from SQS (AI summaries, integration syncs, notification
 * digests, automation actions). The API only enqueues; it never does slow
 * work in a request handler. SQS wiring lands with the first real job.
 */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  const logger = new Logger("Worker");
  logger.log("Worker started — SQS consumer is a stub until the first real job lands.");
  await app.init();
}
bootstrap();
