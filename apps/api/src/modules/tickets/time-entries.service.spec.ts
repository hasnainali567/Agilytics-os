import { describe, expect, it, jest } from "@jest/globals";
import { BadRequestException } from "@nestjs/common";
import { DAILY_UPDATE_NOTE, TimeEntriesService } from "./time-entries.service";
import type { PrismaService } from "../../prisma/prisma.service";

function mockPrisma(overrides: Record<string, unknown> = {}) {
  const timeEntryOverrides = (overrides.timeEntry as object) ?? {};
  return {
    ticket: {
      findFirst: jest.fn(async () => ({ id: "t1" })),
    },
    timeEntry: {
      findMany: jest.fn(async () => []),
      findFirst: jest.fn(async () => null),
      aggregate: jest.fn(async () => ({ _sum: { minutes: 90 } })),
      create: jest.fn(async (args: unknown) => ({ id: "e1", ...(args as { data: object }).data })),
      update: jest.fn(async (args: unknown) => ({ id: "e1", ...(args as { data: object }).data })),
      delete: jest.fn(async () => ({})),
      ...timeEntryOverrides,
    },
  } as unknown as PrismaService;
}

describe("TimeEntriesService", () => {
  it("rejects a future date", () => {
    const service = new TimeEntriesService(mockPrisma());
    expect(() => service.parseDate("2999-01-01")).toThrow(BadRequestException);
  });

  it("lists entries with the summed total for the ticket", async () => {
    const prisma = mockPrisma();
    const service = new TimeEntriesService(prisma);
    await expect(service.list("tenant-1", "t1")).resolves.toEqual({
      entries: [],
      totalMinutes: 90,
    });
  });

  it("syncFromDailyUpdate creates one entry per ticket/member/day", async () => {
    const prisma = mockPrisma();
    const service = new TimeEntriesService(prisma);
    const day = new Date("2026-11-18T00:00:00.000Z");
    await service.syncFromDailyUpdate("tenant-1", "t1", { memberId: "u1", date: day, minutes: 45 });
    expect(prisma.timeEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ minutes: 45, note: DAILY_UPDATE_NOTE }),
    });
  });

  it("syncFromDailyUpdate updates the existing synced entry instead of duplicating it", async () => {
    const prisma = mockPrisma({
      timeEntry: { findFirst: jest.fn(async () => ({ id: "e1", minutes: 30 })) },
    });
    const service = new TimeEntriesService(prisma);
    const day = new Date("2026-11-18T00:00:00.000Z");
    await service.syncFromDailyUpdate("tenant-1", "t1", { memberId: "u1", date: day, minutes: 60 });
    expect(prisma.timeEntry.update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: { minutes: 60 },
    });
    expect(prisma.timeEntry.create).not.toHaveBeenCalled();
  });

  it("syncFromDailyUpdate removes the synced entry when time is cleared", async () => {
    const prisma = mockPrisma({
      timeEntry: { findFirst: jest.fn(async () => ({ id: "e1", minutes: 30 })) },
    });
    const service = new TimeEntriesService(prisma);
    const day = new Date("2026-11-18T00:00:00.000Z");
    await expect(
      service.syncFromDailyUpdate("tenant-1", "t1", { memberId: "u1", date: day, minutes: null }),
    ).resolves.toBeNull();
    expect(prisma.timeEntry.delete).toHaveBeenCalledWith({ where: { id: "e1" } });
  });
});
