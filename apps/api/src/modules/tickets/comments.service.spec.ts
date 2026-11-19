import { describe, expect, it, jest } from "@jest/globals";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { createCommentSchema } from "@agilytics/shared";
import { CommentsService } from "./comments.service";
import type { PrismaService } from "../../prisma/prisma.service";

function mockPrisma(overrides: Record<string, unknown> = {}) {
  const ticketOverrides = (overrides.ticket as object) ?? {};
  const commentOverrides = (overrides.comment as object) ?? {};
  const membershipOverrides = (overrides.membership as object) ?? {};
  return {
    ticket: {
      findFirst: jest.fn(async () => ({
        id: "t1",
        key: "ENG-1",
        title: "Fix login",
        projectId: "p1",
      })),
      ...ticketOverrides,
    },
    comment: {
      findMany: jest.fn(async () => []),
      findFirst: jest.fn(async () => null),
      create: jest.fn(async (args: unknown) => ({
        id: "c1",
        ...(args as { data: object }).data,
      })),
      delete: jest.fn(async () => ({})),
      ...commentOverrides,
    },
    membership: {
      findUnique: jest.fn(async () => ({ role: "MEMBER" })),
      ...membershipOverrides,
    },
    auditLog: {
      create: jest.fn(async () => ({})),
    },
  } as unknown as PrismaService;
}

describe("CommentsService", () => {
  it("rejects creating a comment on another tenant's ticket (404)", async () => {
    const prisma = mockPrisma({
      ticket: { findFirst: jest.fn(async () => null) },
    });
    const service = new CommentsService(prisma);
    await expect(service.create("tenant-2", "t1", "u1", "hello")).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.comment.create).not.toHaveBeenCalled();
  });

  it("creates a comment and audit-logs it", async () => {
    const prisma = mockPrisma();
    const service = new CommentsService(prisma);
    const comment = await service.create("tenant-1", "t1", "u1", "Looks good");
    expect(comment).toEqual(
      expect.objectContaining({ tenantId: "tenant-1", ticketId: "t1", authorId: "u1" }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "comment.created", entity: "Comment" }),
    });
  });

  it("lists comments oldest first", async () => {
    const prisma = mockPrisma();
    const service = new CommentsService(prisma);
    await service.list("tenant-1", "t1");
    expect(prisma.comment.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", ticketId: "t1" },
      orderBy: { createdAt: "asc" },
    });
  });

  it("rejects listing comments for another tenant's ticket (404)", async () => {
    const prisma = mockPrisma({
      ticket: { findFirst: jest.fn(async () => null) },
    });
    const service = new CommentsService(prisma);
    await expect(service.list("tenant-2", "t1")).rejects.toThrow(NotFoundException);
  });

  it("forbids delete by a non-author MEMBER", async () => {
    const prisma = mockPrisma({
      comment: {
        findFirst: jest.fn(async () => ({ id: "c1", authorId: "u-author", ticketId: "t1" })),
      },
      membership: { findUnique: jest.fn(async () => ({ role: "MEMBER" })) },
    });
    const service = new CommentsService(prisma);
    await expect(service.remove("tenant-1", "c1", "u-other")).rejects.toThrow(ForbiddenException);
    expect(prisma.comment.delete).not.toHaveBeenCalled();
  });

  it("allows delete by the author", async () => {
    const prisma = mockPrisma({
      comment: {
        findFirst: jest.fn(async () => ({ id: "c1", authorId: "u1", ticketId: "t1" })),
      },
    });
    const service = new CommentsService(prisma);
    await expect(service.remove("tenant-1", "c1", "u1")).resolves.toEqual({
      id: "c1",
      deleted: true,
    });
    expect(prisma.comment.delete).toHaveBeenCalledWith({ where: { id: "c1" } });
  });

  it("allows delete by a non-author workspace ADMIN", async () => {
    const prisma = mockPrisma({
      comment: {
        findFirst: jest.fn(async () => ({ id: "c1", authorId: "u-author", ticketId: "t1" })),
      },
      membership: { findUnique: jest.fn(async () => ({ role: "ADMIN" })) },
    });
    const service = new CommentsService(prisma);
    await expect(service.remove("tenant-1", "c1", "u-admin")).resolves.toEqual({
      id: "c1",
      deleted: true,
    });
  });

  it("rejects delete of a comment from another tenant (404)", async () => {
    const prisma = mockPrisma({
      comment: { findFirst: jest.fn(async () => null) },
    });
    const service = new CommentsService(prisma);
    await expect(service.remove("tenant-2", "c1", "u1")).rejects.toThrow(NotFoundException);
  });
});

describe("createCommentSchema", () => {
  it("accepts a valid body and trims it", () => {
    expect(createCommentSchema.parse({ body: "  hello  " }).body).toBe("hello");
  });

  it("rejects an empty body", () => {
    expect(() => createCommentSchema.parse({ body: "   " })).toThrow();
    expect(() => createCommentSchema.parse({ body: "" })).toThrow();
  });

  it("rejects a body over 5000 characters", () => {
    expect(() => createCommentSchema.parse({ body: "x".repeat(5001) })).toThrow();
  });
});
