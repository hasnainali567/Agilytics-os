import { describe, expect, it, jest } from "@jest/globals";
import { NotFoundException } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import type { PrismaService } from "../../prisma/prisma.service";

function mockPrisma(overrides: Record<string, unknown> = {}) {
  const notificationOverrides = (overrides.notification as object) ?? {};
  return {
    notification: {
      findMany: jest.fn(async () => []),
      count: jest.fn(async () => 0),
      updateMany: jest.fn(async () => ({ count: 1 })),
      create: jest.fn(async (args: unknown) => ({ id: "n1", ...(args as { data: object }).data })),
      ...notificationOverrides,
    },
  } as unknown as PrismaService;
}

describe("NotificationsService", () => {
  it("lists only the caller's unread inbox, tenant-scoped", async () => {
    const prisma = mockPrisma();
    const service = new NotificationsService(prisma);
    await service.list("tenant-1", "user-1", { unreadOnly: true, type: "MENTION" });
    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", userId: "user-1", type: "MENTION", isRead: false },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  });

  it("counts unread for the inbox badge", async () => {
    const prisma = mockPrisma({ notification: { count: jest.fn(async () => 3) } });
    const service = new NotificationsService(prisma);
    await expect(service.unreadCount("tenant-1", "user-1")).resolves.toEqual({ unread: 3 });
  });

  it("markRead throws when the row is not the caller's (or already read)", async () => {
    const prisma = mockPrisma({
      notification: { updateMany: jest.fn(async () => ({ count: 0 })) },
    });
    const service = new NotificationsService(prisma);
    await expect(service.markRead("tenant-1", "user-1", "n1")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: "n1", tenantId: "tenant-1", userId: "user-1", isRead: false },
      data: { isRead: true },
    });
  });

  it("markAllRead marks only the caller's unread rows", async () => {
    const prisma = mockPrisma({
      notification: { updateMany: jest.fn(async () => ({ count: 4 })) },
    });
    const service = new NotificationsService(prisma);
    await expect(service.markAllRead("tenant-1", "user-1")).resolves.toEqual({ markedRead: 4 });
  });

  it("never notifies the actor about their own assignment", async () => {
    const prisma = mockPrisma();
    const service = new NotificationsService(prisma);
    await expect(
      service.notifyAssignment(
        "tenant-1",
        "user-1",
        { id: "t1", key: "ENG-1", title: "Fix login" },
        "user-1",
      ),
    ).resolves.toBeNull();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it("creates an assignment notification for someone else", async () => {
    const prisma = mockPrisma();
    const service = new NotificationsService(prisma);
    await service.notifyAssignment(
      "tenant-1",
      "user-2",
      { id: "t1", key: "ENG-1", title: "Fix login" },
      "user-1",
    );
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "user-2", type: "ASSIGNMENT", entityId: "t1" }),
    });
  });
});
