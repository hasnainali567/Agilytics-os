import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  list(tenantId: string, projectId?: string) {
    return this.prisma.ticket.findMany({
      where: { tenantId, ...(projectId ? { projectId } : {}) },
      include: { status: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(
    tenantId: string,
    data: {
      projectId: string;
      sprintId?: string;
      boardId?: string;
      statusId?: string;
      title: string;
      description?: string;
      priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
      estimate?: number;
      assigneeId?: string;
      dueDate?: Date;
    },
    createdById?: string,
  ) {
    if (data.statusId) {
      await this.assertColumn(tenantId, data.statusId, data.boardId);
    }
    // Human key: project key + per-project sequence (ENG-123). Generated
    // here because createTicketSchema carries no key and Ticket.key is
    // required by Prisma; retry on a unique conflict (concurrent creates).
    const project = await this.prisma.project.findFirst({
      where: { id: data.projectId, tenantId },
    });
    if (!project) throw new Error("Project not found in this tenant");
    let ticket: Awaited<ReturnType<typeof this.prisma.ticket.create>> | null = null;
    for (let attempt = 0; attempt < 5 && !ticket; attempt += 1) {
      const count = await this.prisma.ticket.count({ where: { projectId: data.projectId } });
      const key = `${project.key}-${count + 1 + attempt}`;
      ticket = await this.prisma.ticket
        .create({ data: { tenantId, ...data, key } })
        .catch(() => null);
    }
    if (!ticket) throw new Error("Could not generate a unique ticket key");
    // Assignee is auto-watched and notified (Slice C: inbox on assignment).
    // Skipped silently when there is no assignee, or the creator assigned it to themself.
    if (data.assigneeId) {
      await this.prisma.ticketWatcher
        .upsert({
          where: { ticketId_userId: { ticketId: ticket.id, userId: data.assigneeId } },
          update: {},
          create: { ticketId: ticket.id, userId: data.assigneeId },
        })
        .catch(() => null);
      await Promise.resolve(
        this.notifications.notifyAssignment(tenantId, data.assigneeId, ticket, createdById),
      ).catch(() => null);
    }
    return ticket;
  }

  /**
   * Status change is the one place history is written — never update
   * statusId directly. Statuses are BoardColumn ids (custom workflows);
   * the column must belong to this tenant and, when the ticket is on a
   * board, to that board. History records who/when/from/to so time-in-
   * status, cycle time and stale detection work with custom names.
   */
  async changeStatus(
    tenantId: string,
    ticketId: string,
    toStatusId: string,
    changedById?: string,
    note?: string,
  ) {
    const ticket = await this.prisma.ticket.findFirst({ where: { id: ticketId, tenantId } });
    if (!ticket) {
      throw new Error("Ticket not found in this tenant");
    }
    await this.assertColumn(tenantId, toStatusId, ticket.boardId);
    const [updated] = await this.prisma.$transaction([
      this.prisma.ticket.update({
        where: { id: ticketId },
        data: { statusId: toStatusId },
      }),
      this.prisma.ticketStatusHistory.create({
        data: { tenantId, ticketId, fromStatusId: ticket.statusId, toStatusId, changedById, note },
      }),
    ]);
    return updated;
  }

  private async assertColumn(tenantId: string, columnId: string, boardId?: string | null) {
    const column = await this.prisma.boardColumn.findFirst({ where: { id: columnId, tenantId } });
    if (!column) {
      throw new Error("Board column not found in this tenant");
    }
    if (boardId && column.boardId !== boardId) {
      throw new Error("Board column does not belong to the ticket's board");
    }
  }
}
