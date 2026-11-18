import { describe, expect, it, jest } from "@jest/globals";
import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { ExecutionContext } from "@nestjs/common";
import type { PrismaService } from "../../prisma/prisma.service";
import { PermissionsGuard, hasOwnOrAny, loadEffectivePermissions } from "./permissions.guard";
import {
  RequireAnyPermission,
  RequireOwnOrAny,
  RequirePermissions,
} from "../decorators/require-permissions.decorator";

type FakePrisma = {
  membership: { findFirst: ReturnType<typeof jest.fn> };
  role: { findFirst: ReturnType<typeof jest.fn> };
  rolePermission: { findMany: ReturnType<typeof jest.fn> };
};

function fakePrisma(overrides: Partial<FakePrisma> = {}): FakePrisma {
  return {
    membership: { findFirst: jest.fn(async () => null) },
    role: { findFirst: jest.fn(async () => null) },
    rolePermission: { findMany: jest.fn(async () => []) },
    ...overrides,
  };
}

/** Membership whose role grants exactly `grants` (via roleId). */
function prismaWithGrants(grants: string[]): FakePrisma {
  return fakePrisma({
    membership: { findFirst: jest.fn(async () => ({ roleId: "role-1", role: "MEMBER" })) },
    rolePermission: {
      findMany: jest.fn(async () => grants.map((permissionKey) => ({ permissionKey }))),
    },
  });
}

function guardFor(prisma: FakePrisma) {
  return new PermissionsGuard(prisma as unknown as PrismaService, new Reflector());
}

function ctxFor(handler: (...args: never[]) => unknown, req: Record<string, unknown>) {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => handler,
    getClass: () => Object,
  } as unknown as ExecutionContext;
}

/** Apply a method decorator to a plain function so Reflector can read it. */
function decorated(handler: (...args: never[]) => unknown, decorator: (target: object) => void) {
  decorator(handler as unknown as object);
  return handler;
}

describe("PermissionsGuard — deny by default", () => {
  it("allows a route with no permission metadata (open to any member)", async () => {
    const guard = guardFor(fakePrisma());
    const handler = () => {};
    await expect(
      guard.canActivate(ctxFor(handler, { user: { id: "u1" }, tenantId: "t1" })),
    ).resolves.toBe(true);
  });

  it("allows when the caller holds the required key, and exposes req.permissions", async () => {
    const guard = guardFor(prismaWithGrants(["ROLES_MANAGE"]));
    const handler = decorated(() => {}, RequirePermissions("ROLES_MANAGE"));
    const req: Record<string, unknown> = { user: { id: "u1" }, tenantId: "t1" };
    await expect(guard.canActivate(ctxFor(handler, req))).resolves.toBe(true);
    expect(req.permissions).toEqual(["ROLES_MANAGE"]);
  });

  it("denies when the caller lacks a required key", async () => {
    const guard = guardFor(prismaWithGrants(["TICKETS_CREATE"]));
    const handler = decorated(() => {}, RequirePermissions("ROLES_MANAGE"));
    await expect(
      guard.canActivate(ctxFor(handler, { user: { id: "u1" }, tenantId: "t1" })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("denies when the caller has no membership in the tenant (empty set)", async () => {
    const guard = guardFor(fakePrisma());
    const handler = decorated(() => {}, RequirePermissions("TICKETS_VIEW_ALL"));
    await expect(
      guard.canActivate(ctxFor(handler, { user: { id: "u1" }, tenantId: "t1" })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("denies when every required key must hold and one is missing", async () => {
    const guard = guardFor(prismaWithGrants(["ROLES_MANAGE"]));
    const handler = decorated(() => {}, RequirePermissions("ROLES_MANAGE", "BILLING_MANAGE"));
    await expect(
      guard.canActivate(ctxFor(handler, { user: { id: "u1" }, tenantId: "t1" })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("RequireAnyPermission passes when the caller holds at least one key", async () => {
    const guard = guardFor(prismaWithGrants(["MEMBERS_ASSIGN_ROLE"]));
    const handler = decorated(
      () => {},
      RequireAnyPermission("ROLES_MANAGE", "MEMBERS_ASSIGN_ROLE"),
    );
    await expect(
      guard.canActivate(ctxFor(handler, { user: { id: "u1" }, tenantId: "t1" })),
    ).resolves.toBe(true);
  });

  it("RequireAnyPermission denies when the caller holds none of the keys", async () => {
    const guard = guardFor(prismaWithGrants(["TICKETS_CREATE"]));
    const handler = decorated(
      () => {},
      RequireAnyPermission("ROLES_MANAGE", "MEMBERS_ASSIGN_ROLE"),
    );
    await expect(
      guard.canActivate(ctxFor(handler, { user: { id: "u1" }, tenantId: "t1" })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("PermissionsGuard — own vs any", () => {
  const ownOrAny = RequireOwnOrAny({
    own: "TICKETS_EDIT_OWN",
    any: "TICKETS_EDIT_ANY",
    owner: (req) => req.params?.ticketOwnerId,
  });

  it("passes on the `any` key regardless of who owns the resource", async () => {
    const guard = guardFor(prismaWithGrants(["TICKETS_EDIT_ANY"]));
    const handler = decorated(() => {}, ownOrAny);
    const req = {
      user: { id: "u1" },
      tenantId: "t1",
      params: { ticketOwnerId: "someone-else" },
    };
    await expect(guard.canActivate(ctxFor(handler, req))).resolves.toBe(true);
  });

  it("passes on the `own` key when the caller owns the resource", async () => {
    const guard = guardFor(prismaWithGrants(["TICKETS_EDIT_OWN"]));
    const handler = decorated(() => {}, ownOrAny);
    const req = {
      user: { id: "u1" },
      tenantId: "t1",
      params: { ticketOwnerId: "u1" },
    };
    await expect(guard.canActivate(ctxFor(handler, req))).resolves.toBe(true);
  });

  it("denies on the `own` key when someone else owns the resource", async () => {
    const guard = guardFor(prismaWithGrants(["TICKETS_EDIT_OWN"]));
    const handler = decorated(() => {}, ownOrAny);
    const req = {
      user: { id: "u1" },
      tenantId: "t1",
      params: { ticketOwnerId: "u2" },
    };
    await expect(guard.canActivate(ctxFor(handler, req))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("denies when the caller holds neither own nor any", async () => {
    const guard = guardFor(prismaWithGrants(["TICKETS_VIEW_ALL"]));
    const handler = decorated(() => {}, ownOrAny);
    const req = {
      user: { id: "u1" },
      tenantId: "t1",
      params: { ticketOwnerId: "u1" },
    };
    await expect(guard.canActivate(ctxFor(handler, req))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

describe("loadEffectivePermissions — legacy fallback", () => {
  it("falls back to the §2.1 MEMBER defaults when a membership has no roleId and no seeded role", async () => {
    const prisma = fakePrisma({
      membership: {
        findFirst: jest.fn(async () => ({ roleId: null, role: "MEMBER" })),
      },
    });
    const permissions = await loadEffectivePermissions(
      prisma as unknown as PrismaService,
      "t1",
      "u1",
    );
    expect(permissions).toContain("TICKETS_CREATE");
    expect(permissions).toContain("TICKETS_EDIT_OWN");
    expect(permissions).not.toContain("TICKETS_DELETE");
    expect(permissions).not.toContain("ROLES_MANAGE");
  });

  it("prefers the seeded system role's grants over the hardcoded defaults", async () => {
    const prisma = fakePrisma({
      membership: {
        findFirst: jest.fn(async () => ({ roleId: null, role: "VIEWER" })),
      },
      role: { findFirst: jest.fn(async () => ({ id: "sys-viewer" })) },
      rolePermission: {
        findMany: jest.fn(async () => [
          { permissionKey: "REPORTING_VIEW" },
          { permissionKey: "REPORTING_VIEW" },
        ]),
      },
    });
    const permissions = await loadEffectivePermissions(
      prisma as unknown as PrismaService,
      "t1",
      "u1",
    );
    expect(permissions).toEqual(["REPORTING_VIEW"]);
  });
});

describe("hasOwnOrAny (service-side, DB-resolved ownership)", () => {
  it("any beats own, own needs matching owner, neither denies", () => {
    const req = { own: "TICKETS_EDIT_OWN" as const, any: "TICKETS_EDIT_ANY" as const };
    expect(hasOwnOrAny(["TICKETS_EDIT_ANY"], req, "u2", "u1")).toBe(true);
    expect(hasOwnOrAny(["TICKETS_EDIT_OWN"], req, "u1", "u1")).toBe(true);
    expect(hasOwnOrAny(["TICKETS_EDIT_OWN"], req, "u2", "u1")).toBe(false);
    expect(hasOwnOrAny(["TICKETS_EDIT_OWN"], req, undefined, "u1")).toBe(false);
    expect(hasOwnOrAny([], req, "u1", "u1")).toBe(false);
  });
});
