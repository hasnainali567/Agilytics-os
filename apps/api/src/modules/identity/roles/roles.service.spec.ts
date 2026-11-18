import { describe, expect, it, jest } from "@jest/globals";
import { BadRequestException, ConflictException } from "@nestjs/common";
import type { PrismaService } from "../../../prisma/prisma.service";
import { RolesService, seedSystemRoles } from "./roles.service";
import { ALL_PERMISSION_KEYS } from "./permission-catalog";

/* eslint-disable @typescript-eslint/no-unused-vars -- fake Prisma mocks accept any call args */
function fakePrisma() {
  return {
    role: {
      findFirst: jest.fn(async (..._args: unknown[]) => null),
      findMany: jest.fn(async (..._args: unknown[]) => []),
      create: jest.fn(async (...args: unknown[]) => args),
      update: jest.fn(async (...args: unknown[]) => args),
      delete: jest.fn(async (..._args: unknown[]) => ({})),
    },
    rolePermission: {
      findMany: jest.fn(async (..._args: unknown[]) => []),
      deleteMany: jest.fn(async (..._args: unknown[]) => ({ count: 0 })),
      createMany: jest.fn(async (..._args: unknown[]) => ({ count: 0 })),
    },
    membership: {
      findFirst: jest.fn(async (..._args: unknown[]) => null),
      count: jest.fn(async (..._args: unknown[]) => 0),
      update: jest.fn(async (...args: unknown[]) => args),
    },
    auditLog: {
      create: jest.fn(async (...args: unknown[]) => args),
    },
    $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  };
}

type FakePrisma = ReturnType<typeof fakePrisma>;

function service(prisma: FakePrisma) {
  return new RolesService(prisma as unknown as PrismaService);
}

describe("RolesService — delete refused when in use", () => {
  it("refuses to delete a role used by members and does not delete it", async () => {
    const prisma = fakePrisma();
    (prisma.role.findFirst as unknown as ReturnType<typeof jest.fn>).mockResolvedValueOnce({
      id: "role-1",
      name: "QA Lead",
      isSystem: false,
    });
    (prisma.membership.count as unknown as ReturnType<typeof jest.fn>).mockResolvedValueOnce(3);
    await expect(service(prisma).deleteRole("t1", "u1", "role-1")).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.role.delete).not.toHaveBeenCalled();
  });

  it("deletes an unused role and audits it", async () => {
    const prisma = fakePrisma();
    (prisma.role.findFirst as unknown as ReturnType<typeof jest.fn>).mockResolvedValueOnce({
      id: "role-1",
      name: "QA Lead",
      isSystem: false,
    });
    (prisma.membership.count as unknown as ReturnType<typeof jest.fn>).mockResolvedValueOnce(0);
    await expect(service(prisma).deleteRole("t1", "u1", "role-1")).resolves.toEqual({
      deleted: "role-1",
    });
    expect(prisma.role.delete).toHaveBeenCalledWith({ where: { id: "role-1" } });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "role.deleted", entity: "Role" }),
      }),
    );
  });
});

describe("RolesService — permission replacement", () => {
  it("rejects unknown permission keys before touching the database", async () => {
    const prisma = fakePrisma();
    await expect(
      service(prisma).replacePermissions("t1", "u1", "role-1", [
        "TICKETS_CREATE",
        "NOT_A_REAL_KEY",
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.rolePermission.deleteMany).not.toHaveBeenCalled();
    expect(prisma.rolePermission.createMany).not.toHaveBeenCalled();
  });

  it("replaces the whole set and audits before/after", async () => {
    const prisma = fakePrisma();
    (prisma.role.findFirst as unknown as ReturnType<typeof jest.fn>).mockResolvedValueOnce({
      id: "role-1",
      name: "Member",
      permissions: [{ permissionKey: "TICKETS_CREATE" }],
    });
    const result = await service(prisma).replacePermissions("t1", "u1", "role-1", [
      "TICKETS_CREATE",
      "TICKETS_EDIT_OWN",
    ]);
    expect(result.permissions).toEqual(["TICKETS_CREATE", "TICKETS_EDIT_OWN"]);
    expect(prisma.rolePermission.deleteMany).toHaveBeenCalledWith({
      where: { roleId: "role-1" },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "role.permissions_replaced",
          metadata: expect.objectContaining({
            before: ["TICKETS_CREATE"],
            after: ["TICKETS_CREATE", "TICKETS_EDIT_OWN"],
          }),
        }),
      }),
    );
  });
});

describe("RolesService — create", () => {
  it("refuses a duplicate role name in the same tenant", async () => {
    const prisma = fakePrisma();
    (prisma.role.findFirst as unknown as ReturnType<typeof jest.fn>).mockResolvedValueOnce({
      id: "existing",
    });
    await expect(
      service(prisma).createRole("t1", "u1", { name: "QA Lead" }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.role.create).not.toHaveBeenCalled();
  });
});

describe("RolesService — catalog", () => {
  it("lists exactly the 42 fixed keys grouped by area", () => {
    const catalog = service(fakePrisma()).listPermissionCatalog();
    expect(catalog.total).toBe(42);
    expect(ALL_PERMISSION_KEYS).toHaveLength(42);
    expect(catalog.areas).toHaveLength(11);
    expect(new Set(ALL_PERMISSION_KEYS).size).toBe(42);
  });
});

describe("seedSystemRoles", () => {
  it("creates all five system roles with their §2.1 defaults when none exist", async () => {
    const prisma = fakePrisma();
    await seedSystemRoles(prisma as unknown as PrismaService, "t1");
    const created = (prisma.role.create as unknown as { mock: { calls: unknown[][] } }).mock
      .calls as {
      data: { name: string; permissions: { create: { permissionKey: string }[] } };
    }[][];
    const names = created.map((c) => (c[0] as unknown as { data: { name: string } }).data.name);
    expect(names).toEqual(["OWNER", "ADMIN", "LEAD", "MEMBER", "VIEWER"]);
    const byName = Object.fromEntries(
      created.map((c) => {
        const data = (
          c[0] as unknown as {
            data: { name: string; permissions: { create: { permissionKey: string }[] } };
          }
        ).data;
        return [data.name, data.permissions.create.map((p) => p.permissionKey)];
      }),
    );
    expect(byName.OWNER).toHaveLength(42);
    expect(byName.ADMIN).toHaveLength(41);
    expect(byName.ADMIN).not.toContain("BILLING_MANAGE");
    expect(byName.LEAD).not.toContain("TICKETS_DELETE");
    expect(byName.LEAD).toContain("TICKETS_EDIT_ANY");
    expect(byName.MEMBER).toContain("TICKETS_EDIT_OWN");
    expect(byName.MEMBER).not.toContain("TICKETS_EDIT_ANY");
    expect(byName.VIEWER).toEqual([
      "WORKSPACE_VIEW_SETTINGS",
      "PROJECTS_VIEW_ALL",
      "TICKETS_VIEW_ALL",
      "DAILY_UPDATES_VIEW_ALL",
      "REPORTING_VIEW",
    ]);
  });

  it("leaves an existing system role (and its edited grants) untouched", async () => {
    const prisma = fakePrisma();
    (prisma.role.findFirst as unknown as ReturnType<typeof jest.fn>).mockResolvedValue({
      id: "existing",
    });
    await seedSystemRoles(prisma as unknown as PrismaService, "t1");
    expect(prisma.role.create).not.toHaveBeenCalled();
  });
});
