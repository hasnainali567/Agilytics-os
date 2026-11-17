import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

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
  ) {
    if (data.statusId) {
      await this.assertColumn(tenantId, data.statusId, data.boardId);
    }
    return this.prisma.ticket.create({
      data: { tenantId, ...data },
    });
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
