import { describe, expect, it, jest } from "@jest/globals";
import { RealtimeGateway } from "./realtime.gateway";
import type { EventBusService } from "./event-bus.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { ConfigService } from "@nestjs/config";
import type { Socket } from "socket.io";

function mockSocket(tenantId: string): Socket & { join: jest.Mock; emit: jest.Mock } {
  return {
    id: "socket-1",
    data: { identity: { userId: "u1", tenantId } },
    join: jest.fn(async () => undefined),
    leave: jest.fn(async () => undefined),
    emit: jest.fn(() => true),
    to: jest.fn(() => ({ emit: jest.fn() })),
  } as unknown as Socket & { join: jest.Mock; emit: jest.Mock };
}

function makeGateway(ticketTenantId: string | null) {
  const prisma = {
    ticket: { findFirst: jest.fn(async () => (ticketTenantId ? { tenantId: ticketTenantId } : null)) },
    auditLog: { create: jest.fn(async () => ({ id: "a1" })) },
  } as unknown as PrismaService;
  const bus = { subscribe: jest.fn(() => () => undefined) } as unknown as EventBusService;
  const config = { get: jest.fn(() => "test-secret") } as unknown as ConfigService;
  const gateway = new RealtimeGateway(prisma, bus, config);
  return { gateway, prisma, bus };
}

describe("RealtimeGateway room authorisation", () => {
  it("joins the ticket room when the ticket belongs to the socket tenant", async () => {
    const { gateway } = makeGateway("tenant-1");
    const socket = mockSocket("tenant-1");
    await expect(gateway.handleJoinTicket(socket, { ticketId: "ticket-1" })).resolves.toEqual({
      ok: true,
    });
    expect(socket.join).toHaveBeenCalledWith("ticket:ticket-1");
  });

  it("rejects a cross-tenant join, emits an error, and audit-logs it", async () => {
    const { gateway, prisma } = makeGateway("tenant-2");
    const socket = mockSocket("tenant-1");
    await expect(gateway.handleJoinTicket(socket, { ticketId: "ticket-1" })).resolves.toEqual({
      ok: false,
      error: "room_join_rejected",
    });
    expect(socket.join).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith(
      "error",
      expect.objectContaining({ code: "room_join_rejected" }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        userId: "u1",
        action: "realtime.room_join_rejected",
        entity: "ticket",
        entityId: "ticket-1",
      }),
    });
  });

  it("rejects a join for an unknown ticket", async () => {
    const { gateway } = makeGateway(null);
    const socket = mockSocket("tenant-1");
    await expect(gateway.handleJoinTicket(socket, { ticketId: "nope" })).resolves.toEqual({
      ok: false,
      error: "room_join_rejected",
    });
    expect(socket.join).not.toHaveBeenCalled();
  });

  it("fans bus envelopes out to their rooms", () => {
    const { gateway, bus } = makeGateway("tenant-1");
    const emit = jest.fn();
    const to = jest.fn((_room: string) => ({ emit }));
    gateway.server = { to } as unknown as import("socket.io").Server;
    gateway.onModuleInit();
    const handler = (bus.subscribe as jest.Mock).mock.calls[0][0] as (e: {
      room: string;
      event: string;
      payload: unknown;
    }) => void;
    handler({ room: "workspace:tenant-1", event: "ticket.created", payload: { ticketId: "t1" } });
    expect(to).toHaveBeenCalledWith("workspace:tenant-1");
    expect(emit).toHaveBeenCalledWith("ticket.created", { ticketId: "t1" });
  });
});
