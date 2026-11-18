import { Injectable, NotFoundException } from "@nestjs/common";
import type { NotificationType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export interface NotificationFilter {
  type?: NotificationType;
  unreadOnly?: boolean;
  limit?: number;
}

export interface CreateNotificationInput {
  type: NotificationType;
  entity?: string;
  entityId?: string;
  title: string;
  body?: string;
}

export interface TicketRef {
  id: string;
  key?: string;
  title: string;
}

function ticketLabel(ticket: TicketRef): string {
  return ticket.key ? `${ticket.key}: ${ticket.title}` : ticket.title;
}

/**
 * Notification Inbox — the one place mentions, assignments, blockers
 * and automation events land (FEATURE-EVALUATION #19, SYSTEM-DESIGN
 * §3.7). Rows are per user and always tenant-scoped; RLS enforces the
 * same boundary at the database layer.
 *
 * Creation hooks: assignment is wired in TicketsService.create.
 * Mention / blocker / stale have no caller in this slice — there is no
 * comments endpoint yet, blockers are raised in DailyUpdatesService and
 * stale is computed by the reporting/worker job — so this service
 * exposes notifyMention / notifyBlocker / notifyStale for those
 * callers to use (see the gap note in the Slice C report).
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, userId: string, filter: NotificationFilter = {}) {
    return this.prisma.notification.findMany({
      where: {
        tenantId,
        userId,
        ...(filter.type ? { type: filter.type } : {}),
        ...(filter.unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(filter.limit ?? 50, 1), 100),
    });
  }

  async unreadCount(tenantId: string, userId: string): Promise<{ unread: number }> {
    const unread = await this.prisma.notification.count({
      where: { tenantId, userId, isRead: false },
    });
    return { unread };
  }

  async markRead(tenantId: string, userId: string, id: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { id, tenantId, userId, isRead: false },
      data: { isRead: true },
    });
    if (count === 0) {
      throw new NotFoundException("Notification not found or already read");
    }
    return { id, isRead: true };
  }

  async markAllRead(tenantId: string, userId: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { tenantId, userId, isRead: false },
      data: { isRead: true },
    });
    return { markedRead: count };
  }

  /** Canonical writer — every trigger below goes through here. */
  createForUser(
    tenantId: string,
    userId: string | null | undefined,
    input: CreateNotificationInput,
  ) {
    if (!userId) return null;
    return this.prisma.notification.create({
      data: { tenantId, userId, ...input },
    });
  }

  /** Ticket assignment — called from TicketsService.create. Never notifies the actor about their own action. */
  async notifyAssignment(
    tenantId: string,
    assigneeId: string | null | undefined,
    ticket: TicketRef,
    actorId?: string,
  ) {
    if (!assigneeId || assigneeId === actorId) return null;
    return this.createForUser(tenantId, assigneeId, {
      type: "ASSIGNMENT",
      entity: "ticket",
      entityId: ticket.id,
      title: `You were assigned ${ticketLabel(ticket)}`,
    });
  }

  /** @mention in a comment — caller: the comments endpoint (not built yet). */
  notifyMention(
    tenantId: string,
    mentionedUserIds: string[],
    ticket: TicketRef,
    authorId?: string,
    authorName?: string,
  ) {
    const targets = [...new Set(mentionedUserIds)].filter((id) => id && id !== authorId);
    return Promise.all(
      targets.map((userId) =>
        this.createForUser(tenantId, userId, {
          type: "MENTION",
          entity: "ticket",
          entityId: ticket.id,
          title: `${authorName ?? "Someone"} mentioned you in ${ticketLabel(ticket)}`,
        }),
      ),
    );
  }

  /** Open blocker on a ticket — caller: DailyUpdatesService (hasBlocker) / worker. */
  notifyBlocker(tenantId: string, userIds: string[], ticket: TicketRef, blockerText?: string) {
    const targets = [...new Set(userIds)].filter(Boolean);
    return Promise.all(
      targets.map((userId) =>
        this.createForUser(tenantId, userId, {
          type: "BLOCKER",
          entity: "ticket",
          entityId: ticket.id,
          title: `Blocked: ${ticketLabel(ticket)}`,
          body: blockerText ?? undefined,
        }),
      ),
    );
  }

  /** Stale ticket (no daily update in 3+ days) — caller: reporting/worker stale job. */
  notifyStale(tenantId: string, userIds: string[], ticket: TicketRef, daysStale: number) {
    const targets = [...new Set(userIds)].filter(Boolean);
    return Promise.all(
      targets.map((userId) =>
        this.createForUser(tenantId, userId, {
          type: "SYSTEM",
          entity: "ticket",
          entityId: ticket.id,
          title: `Stale ticket: ${ticketLabel(ticket)}`,
          body: `No daily update in ${daysStale} days.`,
        }),
      ),
    );
  }
}
