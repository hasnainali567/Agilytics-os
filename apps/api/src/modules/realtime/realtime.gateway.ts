import { Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { PrismaService } from "../../prisma/prisma.service";
import { EventBusService, type RealtimeEnvelope } from "./event-bus.service";
import { PresenceRateLimiter } from "./presence-limiter";
import {
  assertTicketRoom,
  extractSocketToken,
  verifySocketToken,
  workspaceRoom,
  type SocketIdentity,
} from "./socket-auth";

interface PresenceInfo {
  userId: string;
  name?: string;
  ticketId?: string;
  boardId?: string;
}

/**
 * Realtime gateway (docs/REALTIME.md §3 Phase 2).
 *
 * - Auth on handshake: the stored JWT (handshake.auth.token or
 *   ?token=), verified with the SAME verification as JwtAuthGuard
 *   (dev-login JWT today; Cognito JWKS is the later swap — see
 *   socket-auth.ts). No token / invalid token = no connection.
 * - Rooms: `workspace:{tenantId}` (auto-join on connect) and
 *   `ticket:{ticketId}` (join via `joinTicket`, tenant-checked).
 * - Events (first set): ticket.created, ticket.updated,
 *   ticket.status_changed, daily_update.created, notification.created —
 *   emitted by RealtimeService through the event bus; this gateway is
 *   the bus subscriber that fans them out to rooms.
 * - Presence (who is viewing a ticket/board) + typing indicators:
 *   minimal, ephemeral only, never persisted. Live cursors are Phase 3.
 * - Rate-limit: excess presence/typing pings per connection are
 *   dropped, not queued (PresenceRateLimiter).
 */
@WebSocketGateway({
  cors: { origin: process.env.WEB_ORIGIN ?? "http://localhost:5173", credentials: true },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly limiter = new PresenceRateLimiter();
  private readonly presence = new Map<string, PresenceInfo>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBusService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    // Fan-out: every envelope on the bus (in-memory or Redis) is
    // emitted to its room on this task's sockets.
    this.bus.subscribe((envelope: RealtimeEnvelope) => {
      this.server?.to(envelope.room).emit(envelope.event, envelope.payload);
    });
  }

  handleConnection(socket: Socket): void {
    let identity: SocketIdentity;
    try {
      const secret = this.config.get<string>("JWT_SECRET");
      if (!secret) throw new Error("JWT_SECRET is not configured");
      identity = verifySocketToken(extractSocketToken(socket.handshake), secret);
    } catch {
      // No token / invalid token — reject the connection, silently.
      socket.disconnect(true);
      return;
    }
    socket.data.identity = identity;
    void socket.join(workspaceRoom(identity.tenantId));
    this.logger.log(`Socket connected: user ${identity.userId} tenant ${identity.tenantId}`);
  }

  handleDisconnect(socket: Socket): void {
    const info = this.presence.get(socket.id);
    if (info) {
      this.broadcastPresence(socket, info, "left");
      this.presence.delete(socket.id);
    }
    this.limiter.forget(socket.id);
  }

  /** Join a ticket room — the ticket must belong to the socket's tenant. */
  @SubscribeMessage("joinTicket")
  async handleJoinTicket(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { ticketId?: string },
  ): Promise<{ ok: boolean; error?: string }> {
    const identity = socket.data.identity as SocketIdentity | undefined;
    if (!identity) return { ok: false, error: "unauthenticated" };
    const ticketId = body?.ticketId;
    if (!ticketId) return { ok: false, error: "ticketId is required" };
    try {
      const ticket = await this.prisma.ticket.findFirst({
        where: { id: ticketId },
        select: { tenantId: true },
      });
      const room = assertTicketRoom(ticket?.tenantId, identity.tenantId, ticketId);
      await socket.join(room);
      return { ok: true };
    } catch {
      // Cross-tenant (or missing-ticket) join: rejected + audit-logged.
      await this.prisma.auditLog
        .create({
          data: {
            tenantId: identity.tenantId,
            userId: identity.userId,
            action: "realtime.room_join_rejected",
            entity: "ticket",
            entityId: ticketId,
            metadata: { reason: "cross-tenant or unknown ticket" },
          },
        })
        .catch(() => null);
      socket.emit("error", { code: "room_join_rejected", ticketId });
      return { ok: false, error: "room_join_rejected" };
    }
  }

  @SubscribeMessage("leaveTicket")
  async handleLeaveTicket(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { ticketId?: string },
  ): Promise<{ ok: boolean }> {
    if (body?.ticketId) await socket.leave(`ticket:${body.ticketId}`);
    return { ok: true };
  }

  /** Presence: who is viewing a ticket/board. Ephemeral, never persisted. */
  @SubscribeMessage("presence.join")
  handlePresenceJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { ticketId?: string; boardId?: string; name?: string },
  ): void {
    const identity = socket.data.identity as SocketIdentity | undefined;
    if (!identity) return;
    if (!this.limiter.allow(socket.id)) return; // drop excess pings
    const info: PresenceInfo = {
      userId: identity.userId,
      name: body?.name,
      ticketId: body?.ticketId,
      boardId: body?.boardId,
    };
    this.presence.set(socket.id, info);
    this.broadcastPresence(socket, info, "joined");
  }

  @SubscribeMessage("presence.leave")
  handlePresenceLeave(@ConnectedSocket() socket: Socket): void {
    const info = this.presence.get(socket.id);
    if (!info) return;
    this.presence.delete(socket.id);
    this.broadcastPresence(socket, info, "left");
  }

  /** Typing indicator in a ticket's comment composer. Ephemeral. */
  @SubscribeMessage("typing.start")
  handleTypingStart(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { ticketId?: string; name?: string },
  ): void {
    this.broadcastTyping(socket, body?.ticketId, body?.name, true);
  }

  @SubscribeMessage("typing.stop")
  handleTypingStop(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { ticketId?: string; name?: string },
  ): void {
    this.broadcastTyping(socket, body?.ticketId, body?.name, false);
  }

  private broadcastPresence(socket: Socket, info: PresenceInfo, action: "joined" | "left"): void {
    const room = info.ticketId ? `ticket:${info.ticketId}` : workspaceRoom(this.tenantOf(socket));
    socket.to(room).emit("presence.updated", { ...info, action });
  }

  private broadcastTyping(
    socket: Socket,
    ticketId: string | undefined,
    name: string | undefined,
    typing: boolean,
  ): void {
    const identity = socket.data.identity as SocketIdentity | undefined;
    if (!identity || !ticketId) return;
    if (!this.limiter.allow(socket.id)) return; // drop excess pings
    socket.to(`ticket:${ticketId}`).emit("typing", { userId: identity.userId, name, ticketId, typing });
  }

  private tenantOf(socket: Socket): string {
    return (socket.data.identity as SocketIdentity | undefined)?.tenantId ?? "demo-tenant";
  }
}
