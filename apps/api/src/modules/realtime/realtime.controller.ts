import { Controller, Get, Header, HttpCode } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

/**
 * Realtime — Phase 1 stub (see docs/REALTIME.md).
 *
 * GET /notifications/stream is the SSE endpoint the web will subscribe to
 * later. It exists now so the API shape is fixed, but it returns 501 —
 * no events are emitted and no notification rows are stored yet. Phase 1
 * realtime is TanStack Query polling (dashboard refetchInterval).
 * Phase 2 adds the NestJS WebSocket gateway + Redis/Valkey pub-sub
 * adapter; until then there is intentionally no socket.io here.
 */
@ApiTags("realtime")
@Controller("notifications")
export class RealtimeController {
  @Get("stream")
  @HttpCode(501)
  @Header("Content-Type", "text/event-stream")
  @Header("Cache-Control", "no-cache")
  @Header("Connection", "keep-alive")
  stream() {
    return {
      code: "realtime_not_implemented",
      phase: 1,
      message:
        "Realtime events are not implemented yet — the web polls via TanStack Query (see docs/REALTIME.md).",
    };
  }
}
