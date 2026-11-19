import { describe, expect, it, jest } from "@jest/globals";
import { ConflictException, GoneException, NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../../../prisma/prisma.service";
import { InvitesService } from "./invites.service";

/* eslint-disable @typescript-eslint/no-unused-vars -- fake Prisma mocks accept any call args */
function fakePrisma() {
  return {
    role: {
      findFirst: jest.fn(async (..._args: unknown[]) => null),
    },
    user: {
      findUnique: jest.fn(async (..._args: unknown[]) => null),
      create: jest.fn(async (args: { data: Record<string, unknown> }) => ({
        id: args.data.id,
        email: args.data.email,
        name: args.data.name,
      })),
    },
    membership: {
      findFirst: jest.fn(async (..._args: unknown[]) => null),
      upsert: jest.fn(async (args: { create: Record<string, unknown> }) => ({
        id: "membership-1",
        ...args.create,
      })),
    },
    invite: {
      findFirst: jest.fn(async (..._args: unknown[]) => null),
      findUnique: jest.fn(async (..._args: unknown[]) => null),
      findMany: jest.fn(async (..._args: unknown[]) => []),
      create: jest.fn(async (args: { data: Record<string, unknown> }) => ({
        id: "invite-1",
        createdAt: new Date(),
        ...args.data,
      })),
      update: jest.fn(async (args: { data: Record<string, unknown> }) => ({
        id: "invite-1",
        ...args.data,
      })),
    },
    auditLog: {
      create: jest.fn(async (...args: unknown[]) => args),
    },
  };
}

type FakePrisma = ReturnType<typeof fakePrisma>;

function service(prisma: FakePrisma) {
  return new InvitesService(prisma as unknown as PrismaService);
}

const ROLE = { id: "role-member", name: "MEMBER" };
const FUTURE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const PAST = new Date(Date.now() - 60 * 1000);

describe("InvitesService.createInvite", () => {
  it("creates an invite with a random token and a 7-day expiry, and audits it", async () => {
    const prisma = fakePrisma();
    (prisma.role.findFirst as unknown as ReturnType<typeof jest.fn>).mockResolvedValueOnce(ROLE);
    const invite = await service(prisma).createInvite("t1", "owner-user", {
      email: "New@Example.com",
      roleId: "role-member",
    });
    expect(invite.email).toBe("new@example.com");
    expect(invite.token).toMatch(/^[0-9a-f]{64}$/);
    const expiresInDays = (invite.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(expiresInDays).toBeGreaterThan(6.9);
    expect(expiresInDays).toBeLessThanOrEqual(7);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "invite.created", entity: "Invite" }),
      }),
    );
  });

  it("rejects a duplicate pending invite for the same email with 409", async () => {
    const prisma = fakePrisma();
    (prisma.role.findFirst as unknown as ReturnType<typeof jest.fn>).mockResolvedValueOnce(ROLE);
    (prisma.invite.findFirst as unknown as ReturnType<typeof jest.fn>).mockResolvedValueOnce({
      id: "invite-old",
    });
    await expect(
      service(prisma).createInvite("t1", "owner-user", {
        email: "new@example.com",
        roleId: "role-member",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.invite.create).not.toHaveBeenCalled();
  });

  it("rejects inviting someone who is already a member with 409", async () => {
    const prisma = fakePrisma();
    (prisma.role.findFirst as unknown as ReturnType<typeof jest.fn>).mockResolvedValueOnce(ROLE);
    (prisma.user.findUnique as unknown as ReturnType<typeof jest.fn>).mockResolvedValueOnce({
      id: "demo-user",
    });
    (prisma.membership.findFirst as unknown as ReturnType<typeof jest.fn>).mockResolvedValueOnce({
      id: "membership-1",
    });
    await expect(
      service(prisma).createInvite("t1", "owner-user", {
        email: "demo@example.com",
        roleId: "role-member",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.invite.create).not.toHaveBeenCalled();
  });

  it("rejects an unknown role (or a role from another tenant) with 404", async () => {
    const prisma = fakePrisma();
    await expect(
      service(prisma).createInvite("t1", "owner-user", {
        email: "new@example.com",
        roleId: "role-other-tenant",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.invite.create).not.toHaveBeenCalled();
  });
});

describe("InvitesService.listInvites", () => {
  it("lists only this tenant's pending invites, without tokens", async () => {
    const prisma = fakePrisma();
    (prisma.invite.findMany as unknown as ReturnType<typeof jest.fn>).mockResolvedValueOnce([
      {
        id: "invite-1",
        tenantId: "t1",
        email: "a@example.com",
        token: "secret-token-must-not-leak",
        status: "PENDING",
        expiresAt: FUTURE,
        role: { id: "role-member", name: "MEMBER" },
        invitedBy: { id: "owner-user", name: "Olivia Owner", email: "owner@example.com" },
      },
    ]);
    const list = await service(prisma).listInvites("t1");
    expect(prisma.invite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "t1", status: "PENDING" }),
      }),
    );
    expect(list).toHaveLength(1);
    expect(list[0]).not.toHaveProperty("token");
    expect(list[0]?.email).toBe("a@example.com");
  });
});

describe("InvitesService.acceptInvite", () => {
  it("accepts a pending invite: creates the membership with the invited role and audits it", async () => {
    const prisma = fakePrisma();
    (prisma.invite.findUnique as unknown as ReturnType<typeof jest.fn>).mockResolvedValueOnce({
      id: "invite-1",
      tenantId: "t1",
      email: "new@example.com",
      roleId: "role-member",
      status: "PENDING",
      expiresAt: FUTURE,
      role: { id: "role-member", name: "MEMBER" },
    });
    (prisma.user.findUnique as unknown as ReturnType<typeof jest.fn>)
      .mockResolvedValueOnce(null) // no user by id yet
      .mockResolvedValueOnce(null); // no user by email yet
    const result = await service(prisma).acceptInvite("tok-abc", "new-user-id");
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ id: "new-user-id", email: "new@example.com" }),
      }),
    );
    expect(prisma.membership.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_userId: { tenantId: "t1", userId: "new-user-id" } },
        create: expect.objectContaining({ roleId: "role-member" }),
      }),
    );
    expect(prisma.invite.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "ACCEPTED" } }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "invite.accepted", entity: "Invite" }),
      }),
    );
    expect(result.tenantId).toBe("t1");
  });

  it("rejects an expired invite with 410 and marks it EXPIRED", async () => {
    const prisma = fakePrisma();
    (prisma.invite.findUnique as unknown as ReturnType<typeof jest.fn>).mockResolvedValueOnce({
      id: "invite-1",
      tenantId: "t1",
      email: "new@example.com",
      roleId: "role-member",
      status: "PENDING",
      expiresAt: PAST,
      role: { id: "role-member", name: "MEMBER" },
    });
    await expect(service(prisma).acceptInvite("tok-abc", "new-user-id")).rejects.toBeInstanceOf(
      GoneException,
    );
    expect(prisma.invite.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "EXPIRED" } }),
    );
    expect(prisma.membership.upsert).not.toHaveBeenCalled();
  });

  it("rejects an unknown token with 404", async () => {
    const prisma = fakePrisma();
    await expect(service(prisma).acceptInvite("tok-nope", "new-user-id")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe("InvitesService.revokeInvite", () => {
  it("revokes a pending invite and audits it", async () => {
    const prisma = fakePrisma();
    (prisma.invite.findFirst as unknown as ReturnType<typeof jest.fn>).mockResolvedValueOnce({
      id: "invite-1",
      email: "a@example.com",
      status: "PENDING",
    });
    await expect(service(prisma).revokeInvite("t1", "owner-user", "invite-1")).resolves.toEqual({
      id: "invite-1",
      revoked: true,
    });
    expect(prisma.invite.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "REVOKED" } }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "invite.revoked" }),
      }),
    );
  });

  it("refuses to revoke an already-accepted invite", async () => {
    const prisma = fakePrisma();
    (prisma.invite.findFirst as unknown as ReturnType<typeof jest.fn>).mockResolvedValueOnce({
      id: "invite-1",
      email: "a@example.com",
      status: "ACCEPTED",
    });
    await expect(
      service(prisma).revokeInvite("t1", "owner-user", "invite-1"),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.invite.update).not.toHaveBeenCalled();
  });
});
