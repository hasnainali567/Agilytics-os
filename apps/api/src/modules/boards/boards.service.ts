import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { DEFAULT_BOARD_TEMPLATE } from "@agilytics/shared";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Boards / custom workflows. A project has MANY boards; a board's columns
 * are workspace-admin defined (free-text name, order, colour, reporting
 * category) — there is no fixed status list anywhere in v2.
 *
 * Who can change workflows: the company's workspace admin / head
 * (Membership role OWNER or ADMIN). NOT the platform admin — platform
 * admins govern tenants, never a tenant's own workflow. Every mutation
 * checks the caller's membership role first.
 */
@Injectable()
export class BoardsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, projectId?: string) {
    return this.prisma.board.findMany({
      where: { tenantId, ...(projectId ? { projectId } : {}) },
      include: { columns: { orderBy: { order: "asc" } } },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
  }

  get(tenantId: string, boardId: string) {
    return this.prisma.board.findFirst({
      where: { id: boardId, tenantId },
      include: { columns: { orderBy: { order: "asc" } } },
    });
  }

  async create(
    tenantId: string,
    userId: string,
    data: {
      projectId: string;
      name: string;
      description?: string;
      columns?: { name: string; category: "TODO" | "IN_PROGRESS" | "DONE"; colour?: string }[];
    },
  ) {
    await this.requireWorkspaceAdmin(tenantId, userId);
    const project = await this.prisma.project.findFirst({
      where: { id: data.projectId, tenantId },
    });
    if (!project) throw new Error("Project not found in this tenant");
    const columns = data.columns ?? DEFAULT_BOARD_TEMPLATE;
    const board = await this.prisma.board.create({
      data: {
        tenantId,
        projectId: data.projectId,
        name: data.name,
        description: data.description,
        columns: {
          create: columns.map((c, i) => ({ ...c, tenantId, order: i })),
        },
      },
      include: { columns: { orderBy: { order: "asc" } } },
    });
    await this.audit(tenantId, userId, "board.created", "Board", board.id, {
      projectId: data.projectId,
      name: data.name,
    });
    return board;
  }

  async addColumn(
    tenantId: string,
    userId: string,
    boardId: string,
    data: {
      name: string;
      category: "TODO" | "IN_PROGRESS" | "DONE";
      colour?: string;
      order?: number;
    },
  ) {
    await this.requireWorkspaceAdmin(tenantId, userId);
    const board = await this.assertBoard(tenantId, boardId);
    const order =
      data.order ?? (await this.prisma.boardColumn.count({ where: { boardId: board.id } }));
    const column = await this.prisma.boardColumn.create({
      data: { tenantId, boardId: board.id, order, ...data },
    });
    await this.audit(tenantId, userId, "board.column_created", "BoardColumn", column.id, {
      boardId: board.id,
      name: column.name,
      category: column.category,
    });
    return column;
  }

  async updateColumn(
    tenantId: string,
    userId: string,
    boardId: string,
    columnId: string,
    data: {
      name?: string;
      category?: "TODO" | "IN_PROGRESS" | "DONE";
      colour?: string;
      order?: number;
    },
  ) {
    await this.requireWorkspaceAdmin(tenantId, userId);
    await this.assertColumn(tenantId, boardId, columnId);
    const column = await this.prisma.boardColumn.update({ where: { id: columnId }, data });
    await this.audit(tenantId, userId, "board.column_updated", "BoardColumn", columnId, {
      boardId,
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.category !== undefined ? { category: data.category } : {}),
    });
    return column;
  }

  /**
   * Remove a column. Its tickets are moved to `moveTicketsToColumnId`
   * (same board) or left unplaced (statusId null) when omitted — they
   * are never deleted with the column.
   */
  async deleteColumn(
    tenantId: string,
    userId: string,
    boardId: string,
    columnId: string,
    moveTicketsToColumnId?: string,
  ) {
    await this.requireWorkspaceAdmin(tenantId, userId);
    await this.assertColumn(tenantId, boardId, columnId);
    if (moveTicketsToColumnId) {
      await this.assertColumn(tenantId, boardId, moveTicketsToColumnId);
    }
    await this.prisma.$transaction([
      this.prisma.ticket.updateMany({
        where: { tenantId, statusId: columnId },
        data: { statusId: moveTicketsToColumnId ?? null },
      }),
      this.prisma.boardColumn.delete({ where: { id: columnId } }),
    ]);
    await this.audit(tenantId, userId, "board.column_deleted", "BoardColumn", columnId, {
      boardId,
      ...(moveTicketsToColumnId ? { movedTicketsToColumnId: moveTicketsToColumnId } : {}),
    });
    return { deleted: columnId, movedTo: moveTicketsToColumnId ?? null };
  }

  async deleteBoard(tenantId: string, userId: string, boardId: string) {
    await this.requireWorkspaceAdmin(tenantId, userId);
    const board = await this.assertBoard(tenantId, boardId);
    if (board.isDefault) {
      throw new Error(
        "The default board cannot be deleted — changing the default board is not implemented yet",
      );
    }
    await this.prisma.board.delete({ where: { id: boardId } });
    await this.audit(tenantId, userId, "board.deleted", "Board", boardId, {
      projectId: board.projectId,
      name: board.name,
    });
    return { deleted: boardId };
  }

  private async assertBoard(tenantId: string, boardId: string) {
    const board = await this.prisma.board.findFirst({ where: { id: boardId, tenantId } });
    if (!board) throw new Error("Board not found in this tenant");
    return board;
  }

  private async assertColumn(tenantId: string, boardId: string, columnId: string) {
    const column = await this.prisma.boardColumn.findFirst({
      where: { id: columnId, boardId, tenantId },
    });
    if (!column) throw new Error("Board column not found on this board");
    return column;
  }

  /** Workspace admin / company head — Membership OWNER or ADMIN. */
  private async requireWorkspaceAdmin(tenantId: string, userId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });
    if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
      throw new Error("Only a workspace admin (OWNER/ADMIN) can change workflows");
    }
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
