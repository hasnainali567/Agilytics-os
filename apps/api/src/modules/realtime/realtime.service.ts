import { Injectable, Logger } from "@nestjs/common";
import { EventBusService } from "./event-bus.service";

/**
 * RealtimeService — the one place realtime events are emitted from.
 * Mutation sites call one line (fire-and-forget, errors swallowed) and
 * never know whether the transport is in-memory or Redis; the gateway
 * subscribes to the bus and emits to the rooms.
 */
@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);

  constructor(private readonly bus: EventBusService) {}

  emitToWorkspace(tenantId: string, event: string, payload: unknown): void {
    this.emit(`workspace:${tenantId}`, event, payload);
  }

  emitToTicket(ticketId: string, event: string, payload: unknown): void {
    this.emit(`ticket:${ticketId}`, event, payload);
  }

  private emit(room: string, event: string, payload: unknown): void {
    // Fire-and-forget by design: realtime must never break the request
    // that triggered it. The bus itself also never throws.
    void this.bus.publish({ room, event, payload }).catch((err: unknown) => {
      this.logger.warn(`Realtime emit ${event} failed: ${(err as Error).message}`);
    });
  }
}
