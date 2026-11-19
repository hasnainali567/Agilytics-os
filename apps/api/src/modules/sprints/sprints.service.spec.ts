import { describe, expect, it, jest } from "@jest/globals";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { SprintsService } from "./sprints.service";
import type { PrismaService } from "../../prisma/prisma.service";

function mockPrisma(overrides: Record<string, unknown> = {}) {
  const sprintOverrides = (overrides.sprint as object) ?? {};
  return {
    sprint: {
      findFirst: jest.fn(async () => ({
        id: "s1",
        projectId: "p1",
        name: "Sprint 1",
        status: "ACTIVE",
      })),
      update: jest.fn(async (args: unknown) => ({
        id: "s1",
        ...(args as { data: object }).data,
      })),
      ...sprintOverrides,
    },
    auditLog: {
      create: jest.fn(async () => ({})),
    },
  } as unknown as PrismaService;
}

describe("SprintsService", () => {
  it("completes an ACTIVE sprint and audit-logs it", async () => {
    const prisma = mockPrisma();
    const service = new SprintsService(prisma);
    const updated = await service.complete("tenant-1", "s1", "u1");
    expect(prisma.sprint.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { status: "COMPLETED" },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "sprint.completed", entity: "Sprint" }),
    });
    expect(updated.status).toBe("COMPLETED");
  });

  it("rejects completing an already-completed sprint", async () => {
    const prisma = mockPrisma({
      sprint: {
        findFirst: jest.fn(async () => ({
          id: "s1",
          projectId: "p1",
          name: "Sprint 1",
          status: "COMPLETED",
        })),
      },
    });
    const service = new SprintsService(prisma);
    await expect(service.complete("tenant-1", "s1", "u1")).rejects.toThrow(BadRequestException);
    expect(prisma.sprint.update).not.toHaveBeenCalled();
  });

  it("rejects completing a sprint from another tenant (404)", async () => {
    const prisma = mockPrisma({
      sprint: { findFirst: jest.fn(async () => null) },
    });
    const service = new SprintsService(prisma);
    await expect(service.complete("tenant-2", "s1", "u1")).rejects.toThrow(NotFoundException);
    expect(prisma.sprint.update).not.toHaveBeenCalled();
  });

  it("starts a PLANNED sprint", async () => {
    const prisma = mockPrisma({
      sprint: {
        findFirst: jest.fn(async () => ({
          id: "s1",
          projectId: "p1",
          name: "Sprint 1",
          status: "PLANNED",
        })),
      },
    });
    const service = new SprintsService(prisma);
    const updated = await service.start("tenant-1", "s1", "u1");
    expect(prisma.sprint.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { status: "ACTIVE" },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "sprint.started", entity: "Sprint" }),
    });
    expect(updated.status).toBe("ACTIVE");
  });

  it("rejects starting a sprint that is not PLANNED", async () => {
    const prisma = mockPrisma();
    const service = new SprintsService(prisma);
    await expect(service.start("tenant-1", "s1", "u1")).rejects.toThrow(BadRequestException);
    expect(prisma.sprint.update).not.toHaveBeenCalled();
  });

  it("rejects starting a sprint from another tenant (404)", async () => {
    const prisma = mockPrisma({
      sprint: { findFirst: jest.fn(async () => null) },
    });
    const service = new SprintsService(prisma);
    await expect(service.start("tenant-2", "s1", "u1")).rejects.toThrow(NotFoundException);
  });
});
