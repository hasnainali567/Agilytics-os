import { Module } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { EventBusService } from "./event-bus.service";
import { RealtimeController } from "./realtime.controller";
import { RealtimeGateway } from "./realtime.gateway";
import { RealtimeService } from "./realtime.service";

/**
 * Realtime — Phase 2 (docs/REALTIME.md §3).
 * SSE stub endpoint kept as-is for compatibility; the WebSocket gateway
 * is the live path. RealtimeService is exported so tickets,
 * daily-updates and notifications can emit one-line events.
 */
@Module({
  controllers: [RealtimeController],
  providers: [RealtimeGateway, RealtimeService, EventBusService, PrismaService],
  exports: [RealtimeService, EventBusService],
})
export class RealtimeModule {}
