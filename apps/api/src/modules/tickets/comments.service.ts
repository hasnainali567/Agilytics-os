import { ForbiddenException, Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { emitAutomationEvent } from "../../common/automation-events";
import { PrismaService } from "../../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";

/**
 * Ticket comments — tenant-scoped sub-resource of a ticket.
 *
 * Tenant isolation is enforced in the service, not just the guard:
 * every read/write first proves the ticket belongs to `req.tenantId`
 * (a ticket from another tenant is a 404, same convention as
 * TimeEntriesService.assertTicketInTenant). Delete is author-only,
 * except a workspace admin (Membership OWNER/ADMIN, same check as
 * BoardsService.requireWorkspaceAdmin) may delete anyone's comment.
 */
@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(RealtimeService) private readonly realtime?: RealtimeService,
  ) {}

  private async assertTicketInTenant(tenantId: string, ticketId: string) {
    const ticket = await this.prisma.ticket.findFirst({ where: { id: ticketId, tenantId } });
    if (!ticket) throw new NotFoundException("Ticket not found in this tenant");
    return ticket;
  }

  /** Oldest first — a comment thread reads top to bottom. */
  async list(tenantId: string, ticketId: string) {
    await this.assertTicketInTenant(tenantId, ticketId);
    return this.prisma.comment.findMany({
      where: { tenantId, ticketId },
      orderBy: { createdAt: "asc" },
    });
  }

  async create(tenantId: string, ticketId: string, authorId: string, body: string) {
    const ticket = await this.assertTicketInTenant(tenantId, ticketId);
    const comment = await this.prisma.comment.create({
      data: { tenantId, ticketId, authorId, body },
    });
    await this.audit(tenantId, authorId, "comment.created", "Comment", comment.id, {
      ticketId,
      ticketKey: ticket.key,
    });
    // [Phase 2 realtime] one-line emit — fire-and-forget, never breaks the request.
    this.realtime?.emitToTicket(ticketId, "comment.created", {
      ticketId,
      commentId: comment.id,
      authorId,
    });
    // [worker-b: automations] one-line hook — automation rules (comment.created). Never throws.
    emitAutomationEvent("comment.created", tenantId, {
      ticketId,
      ticketKey: ticket.key,
      ticketTitle: ticket.title,
      projectId: ticket.projectId,
      userId: authorId,
      text: body,
    });
    return comment;
  }

  /**
   * Author or workspace admin only. A non-author MEMBER gets a 403;
   * a comment from another tenant is a 404 (tenant check first).
   */
  async remove(tenantId: string, commentId: string, userId: string) {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, tenantId },
    });
    if (!comment) throw new NotFoundException("Comment not found in this tenant");
    if (comment.authorId !== userId) {
      const membership = await this.prisma.membership.findUnique({
        where: { tenantId_userId: { tenantId, userId } },
      });
      if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
        throw new ForbiddenException("Only the comment author or a workspace admin can delete it");
      }
    }
    await this.prisma.comment.delete({ where: { id: commentId } });
    await this.audit(tenantId, userId, "comment.deleted", "Comment", commentId, {
      ticketId: comment.ticketId,
    });
    return { id: commentId, deleted: true };
  }

  /** Same audit() shape as RolesService — one AuditLog row per mutation. */
  private audit(
    tenantId: string,
    userId: string,
    action: string,
    entity: string,
    entityId: string,
    metadata: Record<string, unknown>,
  ) {
    return this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action,
        entity,
        entityId,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }
}
