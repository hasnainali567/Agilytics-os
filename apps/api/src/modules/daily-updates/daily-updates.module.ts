import { Module } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { TicketsModule } from "../tickets/tickets.module";
import { DailyUpdatesController } from "./daily-updates.controller";
import { DailyUpdatesService } from "./daily-updates.service";

@Module({
  imports: [NotificationsModule, TicketsModule, RealtimeModule],
  controllers: [DailyUpdatesController],
  providers: [DailyUpdatesService, PrismaService],
  exports: [DailyUpdatesService],
})
export class DailyUpdatesModule {}
