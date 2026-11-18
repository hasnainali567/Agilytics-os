import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Ticket watchers — users following a ticket (FEATURE-EVALUATION #4).
 * Watchers are the audience for mention / blocker / stale
 * notifications. The assignee is auto-watched on ticket creation
 * (TicketsService.create). Only workspace members can watch.
 */
@Injectable()
export class TicketWatchersService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertTicketInTenant(tenantId: string, ticketId: string) {
    const ticket = await this.prisma.ticket.findFirst({ where: { id: ticketId, tenantId } });
    if (!ticket) throw new NotFoundException("Ticket not found in this tenant");
  }

  async list(tenantId: string, ticketId: string) {
    await this.assertTicketInTenant(tenantId, ticketId);
    return this.prisma.ticketWatcher.findMany({
      where: { ticket: { id: ticketId, tenantId } },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { user: { name: "asc" } },
    });
  }

  async add(tenantId: string, ticketId: string, userId: string) {
    await this.assertTicketInTenant(tenantId, ticketId);
    const membership = await this.prisma.membership.findFirst({ where: { tenantId, userId } });
    if (!membership) {
      throw new BadRequestException("Only a member of this workspace can watch a ticket");
    }
    return this.prisma.ticketWatcher.upsert({
      where: { ticketId_userId: { ticketId, userId } },
      update: {},
      create: { ticketId, userId },
    });
  }

  async remove(tenantId: string, ticketId: string, userId: string) {
    await this.assertTicketInTenant(tenantId, ticketId);
    try {
      await this.prisma.ticketWatcher.delete({ where: { ticketId_userId: { ticketId, userId } } });
    } catch {
      throw new NotFoundException("Watcher not found on this ticket");
    }
    return { ticketId, userId, deleted: true };
  }
}
