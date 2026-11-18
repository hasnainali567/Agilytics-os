import { describe, expect, it, jest } from "@jest/globals";
import type { PrismaService } from "../../../prisma/prisma.service";
import { DashboardLayoutsService } from "./dashboard-layouts.service";
import { defaultLayoutFor } from "./templates";

const TENANT = "tenant-1";
const OTHER_TENANT = "tenant-2";
const USER = "user-1";

function mockPrisma() {
  const dashboardLayout = {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
  };
  const membership = { findUnique: jest.fn() };
  const prisma = { dashboardLayout, membership } as unknown as PrismaService;
  return { prisma, dashboardLayout, membership };
}

describe("DashboardLayoutsService", () => {
  it("returns the stored layout when one exists", async () => {
    const stored = defaultLayoutFor("manager");
    const { prisma, dashboardLayout } = mockPrisma();
    dashboardLayout.findUnique.mockImplementation(async () => ({
      id: "l1",
      name: "default",
      layout: stored,
      template: "manager",
      isDefault: true,
    }));
    const service = new DashboardLayoutsService(prisma);
    const result = await service.getLayout(TENANT, USER);
    expect(result.persisted).toBe(true);
    expect(result.id).toBe("l1");
    expect(result.layout.widgets).toHaveLength(stored.widgets.length);
  });

  it("returns a generated, unpersisted default seeded from the membership role", async () => {
    const { prisma, dashboardLayout, membership } = mockPrisma();
    dashboardLayout.findUnique.mockImplementation(async () => null);
    membership.findUnique.mockImplementation(async () => ({ role: "ADMIN" }));
    const service = new DashboardLayoutsService(prisma);
    const result = await service.getLayout(TENANT, USER);
    expect(result.persisted).toBe(false);
    expect(result.template).toBe("manager");
    expect(result.layout).toEqual(defaultLayoutFor("manager"));
    expect(membership.findUnique).toHaveBeenCalledWith({
      where: { tenantId_userId: { tenantId: TENANT, userId: USER } },
      select: { role: true },
    });
  });

  it("falls back to the developer template with no membership", async () => {
    const { prisma, dashboardLayout, membership } = mockPrisma();
    dashboardLayout.findUnique.mockImplementation(async () => null);
    membership.findUnique.mockImplementation(async () => null);
    const service = new DashboardLayoutsService(prisma);
    const result = await service.getLayout(TENANT, USER);
    expect(result.template).toBe("developer");
  });

  it("scopes every lookup by tenant AND user, never by name alone", async () => {
    const { prisma, dashboardLayout, membership } = mockPrisma();
    dashboardLayout.findUnique.mockImplementation(async () => null);
    membership.findUnique.mockImplementation(async () => ({ role: "MEMBER" }));
    const service = new DashboardLayoutsService(prisma);
    await service.getLayout(OTHER_TENANT, USER);
    expect(dashboardLayout.findUnique).toHaveBeenCalledWith({
      where: { userId_tenantId_name: { userId: USER, tenantId: OTHER_TENANT, name: "default" } },
    });
  });

  it("saves via upsert on the (userId, tenantId, name) key and rejects bad layouts", async () => {
    const layout = defaultLayoutFor("lead");
    const { prisma, dashboardLayout } = mockPrisma();
    dashboardLayout.upsert.mockImplementation(async () => ({
      id: "l2",
      name: "default",
      layout,
      template: "lead",
      isDefault: true,
    }));
    const service = new DashboardLayoutsService(prisma);
    const saved = await service.saveLayout(TENANT, USER, { layout, template: "lead" });
    expect(saved.persisted).toBe(true);
    expect(dashboardLayout.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_tenantId_name: { userId: USER, tenantId: TENANT, name: "default" } },
      }),
    );
    await expect(
      service.saveLayout(TENANT, USER, {
        layout: { widgets: [{ ...layout.widgets[0], type: "not-a-widget" }], ui: layout.ui },
      }),
    ).rejects.toThrow();
  });

  it("reset deletes the stored row and returns the fresh template default", async () => {
    const { prisma, dashboardLayout } = mockPrisma();
    dashboardLayout.findUnique.mockImplementation(async () => ({
      id: "l1",
      name: "default",
      layout: defaultLayoutFor("manager"),
      template: "manager",
      isDefault: true,
    }));
    dashboardLayout.delete.mockImplementation(async () => ({}));
    const service = new DashboardLayoutsService(prisma);
    const result = await service.resetLayout(TENANT, USER, {});
    expect(dashboardLayout.delete).toHaveBeenCalledWith({ where: { id: "l1" } });
    expect(result.persisted).toBe(false);
    expect(result.layout).toEqual(defaultLayoutFor("manager"));
  });

  it("reset succeeds even when nothing was ever saved", async () => {
    const { prisma, dashboardLayout, membership } = mockPrisma();
    dashboardLayout.findUnique.mockImplementation(async () => null);
    membership.findUnique.mockImplementation(async () => ({ role: "MEMBER" }));
    const service = new DashboardLayoutsService(prisma);
    const result = await service.resetLayout(TENANT, USER, {});
    expect(dashboardLayout.delete).not.toHaveBeenCalled();
    expect(result.persisted).toBe(false);
    expect(result.layout.widgets.length).toBeGreaterThan(0);
  });
});
