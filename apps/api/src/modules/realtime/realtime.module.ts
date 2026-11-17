import { Module } from "@nestjs/common";
import { RealtimeController } from "./realtime.controller";

/** Phase 1: SSE endpoint stub only. Phase 2 adds the WebSocket gateway here. */
@Module({
  controllers: [RealtimeController],
})
export class RealtimeModule {}
