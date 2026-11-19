import { Module } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { RealtimeModule } from "../realtime/realtime.module";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

/**
 * Notification Inbox module. Exports NotificationsService so the
 * tickets module (assignment) — and later the comments, daily-updates
 * and worker slices — can create notifications without duplicating
 * the write path.
 */
@Module({
  imports: [RealtimeModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, PrismaService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
