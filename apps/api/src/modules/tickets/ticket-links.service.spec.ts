import { describe, expect, it, jest } from "@jest/globals";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { TicketLinksService } from "./ticket-links.service";
import type { PrismaService } from "../../prisma/prisma.service";

const T1 = "00000000-0000-4000-8000-000000000001";
const T2 = "00000000-0000-4000-8000-000000000002";

function mockPrisma(overrides: Record<string, unknown> = {}) {
  const ticketLinkOverrides = (overrides.ticketLink as object) ?? {};
  return {
    ticket: {
      findMany: jest.fn(async () => [{ id: T1 }, { id: T2 }]),
    },
    ticketLink: {
      findFirst: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
      create: jest.fn(async (args: unknown) => ({ id: "l1", ...(args as { data: object }).data })),
      delete: jest.fn(async () => ({})),
      ...ticketLinkOverrides,
    },
  } as unknown as PrismaService;
}

describe("TicketLinksService", () => {
  it("rejects a self-link without touching the database", async () => {
    const prisma = mockPrisma();
    const service = new TicketLinksService(prisma);
    await expect(
      service.create("tenant-1", T1, { toTicketId: T1, type: "BLOCKS" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.ticketLink.create).not.toHaveBeenCalled();
  });

  it("rejects a duplicate link (same pair, same type)", async () => {
    const prisma = mockPrisma({ ticketLink: { findFirst: jest.fn(async () => ({ id: "l0" })) } });
    const service = new TicketLinksService(prisma);
    await expect(
      service.create("tenant-1", T1, { toTicketId: T2, type: "RELATES_TO" }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.ticketLink.create).not.toHaveBeenCalled();
  });

  it("rejects a duplicate link in the opposite direction", async () => {
    const prisma = mockPrisma({ ticketLink: { findFirst: jest.fn(async () => ({ id: "l0" })) } });
    const service = new TicketLinksService(prisma);
    await expect(
      service.create("tenant-1", T2, { toTicketId: T1, type: "RELATES_TO" }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("normalises BLOCKED_BY into the stored BLOCKS direction", async () => {
    const prisma = mockPrisma();
    const service = new TicketLinksService(prisma);
    await service.create("tenant-1", T1, { toTicketId: T2, type: "BLOCKED_BY" });
    expect(prisma.ticketLink.create).toHaveBeenCalledWith({
      data: { tenantId: "tenant-1", fromTicketId: T2, toTicketId: T1, type: "BLOCKS" },
    });
  });

  it("creates a plain RELATES_TO link unchanged", async () => {
    const prisma = mockPrisma();
    const service = new TicketLinksService(prisma);
    await service.create("tenant-1", T1, { toTicketId: T2, type: "RELATES_TO" });
    expect(prisma.ticketLink.create).toHaveBeenCalledWith({
      data: { tenantId: "tenant-1", fromTicketId: T1, toTicketId: T2, type: "RELATES_TO" },
    });
  });
});
