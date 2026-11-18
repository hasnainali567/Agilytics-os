import { Controller, Get, Param, Patch, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { NotificationType } from "@prisma/client";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantId } from "../../common/decorators/tenant.decorator";
import { NotificationsService } from "./notifications.service";

type ReqUser = { user?: { id?: string } };

const NOTIFICATION_TYPES: NotificationType[] = [
  "MENTION",
  "ASSIGNMENT",
  "BLOCKER",
  "AUTOMATION",
  "SYSTEM",
];

/**
 * Notification Inbox (Phase 1 surface, SYSTEM-DESIGN §3.7 / §5).
 * One list, read/unread, filter by type. The SSE stream lives in the
 * realtime module (GET /notifications/stream, 501 stub) — this
 * controller owns only the stored inbox rows.
 */
@ApiTags("notifications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @TenantId() tenantId: string,
    @Req() req: ReqUser,
    @Query("type") type?: string,
    @Query("unreadOnly") unreadOnly?: string,
    @Query("limit") limit?: string,
  ) {
    const parsedType =
      type && (NOTIFICATION_TYPES as string[]).includes(type)
        ? (type as NotificationType)
        : undefined;
    return this.notifications.list(tenantId, req.user?.id ?? "unknown", {
      type: parsedType,
      unreadOnly: unreadOnly === "true",
      limit: limit && !Number.isNaN(Number(limit)) ? Number(limit) : undefined,
    });
  }

  @Get("unread-count")
  unreadCount(@TenantId() tenantId: string, @Req() req: ReqUser) {
    return this.notifications.unreadCount(tenantId, req.user?.id ?? "unknown");
  }

  @Patch("read-all")
  markAllRead(@TenantId() tenantId: string, @Req() req: ReqUser) {
    return this.notifications.markAllRead(tenantId, req.user?.id ?? "unknown");
  }

  @Patch(":id/read")
  markRead(@TenantId() tenantId: string, @Req() req: ReqUser, @Param("id") id: string) {
    return this.notifications.markRead(tenantId, req.user?.id ?? "unknown", id);
  }
}
