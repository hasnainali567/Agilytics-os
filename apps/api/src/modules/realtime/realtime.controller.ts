import { Controller, Sse, UseGuards, type MessageEvent } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Observable } from "rxjs";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantId } from "../../common/decorators/tenant.decorator";
import { EventBusService } from "./event-bus.service";

/** SSE heartbeat interval — keeps proxies / load balancers from closing an idle stream. */
const HEARTBEAT_MS = 30_000;

/**
 * Realtime — SSE stream (see docs/REALTIME.md).
 *
 * GET /notifications/stream is the live Server-Sent Events feed for the
 * authenticated tenant. The WebSocket gateway stays the interactive
 * path (presence, per-ticket rooms); this stream is the workspace-level
 * feed — notification / ticket events published to
 * `workspace:<tenantId>` via RealtimeService → EventBus.
 *
 * NOTE: EventSource cannot send an Authorization header — clients
 * subscribe with fetch + ReadableStream and pass the Bearer token.
 */
@ApiTags("realtime")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class RealtimeController {
  constructor(private readonly bus: EventBusService) {}

  /**
   * Live SSE stream for the authenticated tenant.
   *
   * Emits a `connected` event on subscribe, then every envelope
   * published to this tenant's workspace room, plus a `heartbeat`
   * every 30s. Disconnecting unsubscribes from the bus and clears the
   * heartbeat — no leak, no 501.
   */
  @Sse("stream")
  @ApiOperation({ summary: "Live SSE stream of workspace events for this tenant" })
  @ApiResponse({
    status: 200,
    description: "Event stream (connected, heartbeat, workspace events)",
  })
  stream(@TenantId() tenantId: string): Observable<MessageEvent> {
    const room = `workspace:${tenantId}`;
    return new Observable<MessageEvent>((subscriber) => {
      const unsubscribe = this.bus.subscribe((envelope) => {
        if (envelope.room !== room) return;
        subscriber.next({ data: { event: envelope.event, payload: envelope.payload } });
      });
      subscriber.next({ data: { event: "connected", room } });
      const heartbeat = setInterval(() => {
        subscriber.next({ data: { event: "heartbeat", at: new Date().toISOString() } });
      }, HEARTBEAT_MS);
      return () => {
        clearInterval(heartbeat);
        unsubscribe();
      };
    });
  }
}
