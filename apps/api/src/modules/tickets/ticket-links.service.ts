import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { TicketLinkType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { TicketLinkTypeInput } from "./tickets.dto";

/**
 * TicketLink — dependencies between tickets (FEATURE-EVALUATION #25).
 * BLOCKS means fromTicket blocks toTicket. BLOCKED_BY is accepted as
 * input but normalised: `A BLOCKED_BY B` is stored as `B BLOCKS A`,
 * so one direction exists in the table and the unique constraint
 * ([fromTicketId, toTicketId, type]) can do its job.
 *
 * Rules enforced here, not just by the DB: no self-link, no duplicate
 * link (either direction — RELATES_TO / DUPLICATES are symmetric, and
 * a second BLOCKS in the opposite direction would be a cycle).
 */
@Injectable()
export class TicketLinksService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertTicketsInTenant(tenantId: string, ticketIds: string[]) {
    const tickets = await this.prisma.ticket.findMany({
      where: { id: { in: ticketIds }, tenantId },
      select: { id: true },
    });
    if (tickets.length !== ticketIds.length) {
      throw new NotFoundException("Ticket not found in this tenant");
    }
  }

  /** All links touching a ticket, either direction, with the other ticket's key/title. */
  async list(tenantId: string, ticketId: string) {
    await this.assertTicketsInTenant(tenantId, [ticketId]);
    return this.prisma.ticketLink.findMany({
      where: { tenantId, OR: [{ fromTicketId: ticketId }, { toTicketId: ticketId }] },
      include: {
        fromTicket: { select: { id: true, key: true, title: true } },
        toTicket: { select: { id: true, key: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Tickets blocking this one — the board's blocked badge reads this. */
  async blockersFor(tenantId: string, ticketId: string) {
    await this.assertTicketsInTenant(tenantId, [ticketId]);
    return this.prisma.ticketLink.findMany({
      where: { tenantId, toTicketId: ticketId, type: "BLOCKS" },
      include: { fromTicket: { select: { id: true, key: true, title: true } } },
    });
  }

  async create(
    tenantId: string,
    fromTicketId: string,
    input: { toTicketId: string; type: TicketLinkTypeInput },
  ) {
    if (input.toTicketId === fromTicketId) {
      throw new BadRequestException("A ticket cannot link to itself");
    }
    // Normalise BLOCKED_BY into the stored BLOCKS direction first —
    // duplicate checks below then see the canonical form.
    let from = fromTicketId;
    let to = input.toTicketId;
    let type: TicketLinkType = input.type;
    if (type === "BLOCKED_BY") {
      from = input.toTicketId;
      to = fromTicketId;
      type = "BLOCKS";
    }
    await this.assertTicketsInTenant(tenantId, [fromTicketId, input.toTicketId]);
    const existing = await this.prisma.ticketLink.findFirst({
      where: {
        tenantId,
        type,
        OR: [
          { fromTicketId: from, toTicketId: to },
          { fromTicketId: to, toTicketId: from },
        ],
      },
    });
    if (existing) {
      throw new ConflictException("These tickets are already linked this way");
    }
    return this.prisma.ticketLink.create({
      data: { tenantId, fromTicketId: from, toTicketId: to, type },
    });
  }

  async remove(tenantId: string, ticketId: string, linkId: string) {
    const link = await this.prisma.ticketLink.findFirst({
      where: {
        id: linkId,
        tenantId,
        OR: [{ fromTicketId: ticketId }, { toTicketId: ticketId }],
      },
    });
    if (!link) {
      throw new NotFoundException("Ticket link not found on this ticket");
    }
    await this.prisma.ticketLink.delete({ where: { id: linkId } });
    return { id: linkId, deleted: true };
  }
}
