import { Module } from "@nestjs/common";
import { StorageService } from "../../common/storage/storage.service";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { TicketAttachmentsService } from "./ticket-attachments.service";
import { TicketLinksService } from "./ticket-links.service";
import { TicketWatchersService } from "./ticket-watchers.service";
import { TicketsController } from "./tickets.controller";
import { TicketsService } from "./tickets.service";
import { TimeEntriesService } from "./time-entries.service";
import { CommentsController } from "./comments.controller";
import { CommentsService } from "./comments.service";

@Module({
  imports: [NotificationsModule, RealtimeModule],
  controllers: [TicketsController, CommentsController],
  providers: [
    TicketsService,
    TicketLinksService,
    TicketWatchersService,
    TicketAttachmentsService,
    TimeEntriesService,
    CommentsService,
    PrismaService,
    StorageService,
  ],
  exports: [TicketsService, TimeEntriesService, CommentsService],
})
export class TicketsModule {}
