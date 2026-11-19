import { describe, expect, it, jest } from "@jest/globals";
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../../prisma/prisma.service";
import { BillingService } from "./billing.service";
import {
  PLAN_FEATURES,
  assertAutomationRuleAllowed,
  getOrganisationPlan,
  getPlanFeatures,
} from "./plan-features";

/* eslint-disable @typescript-eslint/no-unused-vars -- fake Prisma mocks accept any call args */
function fakePrisma() {
  return {
    organisation: {
      findUnique: jest.fn(async (..._args: unknown[]) => null),
      update: jest.fn(async (args: { data: Record<string, unknown> }) => ({
        id: "t1",
        ...args.data,
      })),
    },
    automationRule: {
      count: jest.fn(async (..._args: unknown[]) => 0),
    },
    auditLog: {
      create: jest.fn(async (...args: unknown[]) => args),
    },
  };
}

describe("plan-features map", () => {
  it("matches the DECISION-SHEET Q1 PKR tiers", () => {
    expect(PLAN_FEATURES.STARTER.pricePkrPerUserPerMonth).toBe(1500);
    expect(PLAN_FEATURES.GROWTH.pricePkrPerUserPerMonth).toBe(2500);
    expect(PLAN_FEATURES.BUSINESS.pricePkrPerUserPerMonth).toBe(4000);
    expect(PLAN_FEATURES.ENTERPRISE.pricePkrPerUserPerMonth).toBeNull();
    expect(PLAN_FEATURES.FREE.pricePkrPerUserPerMonth).toBe(0);
  });

  it("caps FREE at 3 automation rules and leaves BUSINESS unlimited", () => {
    expect(getPlanFeatures("FREE").maxAutomationRules).toBe(3);
    expect(getPlanFeatures("STARTER").maxAutomationRules).toBe(10);
    expect(getPlanFeatures("GROWTH").maxAutomationRules).toBe(25);
    expect(getPlanFeatures("BUSINESS").maxAutomationRules).toBeNull();
    expect(getPlanFeatures("ENTERPRISE").maxAutomationRules).toBeNull();
  });

  it("gates realtime and AI off on FREE, on for paid plans", () => {
    expect(getPlanFeatures("FREE").realtime).toBe(false);
    expect(getPlanFeatures("FREE").ai).toBe(false);
    expect(getPlanFeatures("STARTER").realtime).toBe(true);
    expect(getPlanFeatures("STARTER").ai).toBe(true);
    expect(getPlanFeatures("ENTERPRISE").sso).toBe(true);
    expect(getPlanFeatures("BUSINESS").sso).toBe(false);
  });
});

describe("getOrganisationPlan", () => {
  it("defaults to FREE when the organisation has no row", async () => {
    const prisma = fakePrisma();
    await expect(
      getOrganisationPlan(prisma as unknown as PrismaService, "missing-tenant"),
    ).resolves.toBe("FREE");
  });
});

describe("assertAutomationRuleAllowed — FREE cap enforcement", () => {
  it("allows a rule under the FREE cap", async () => {
    const prisma = fakePrisma();
    (prisma.organisation.findUnique as unknown as ReturnType<typeof jest.fn>).mockResolvedValueOnce({
      plan: "FREE",
    });
    (prisma.automationRule.count as unknown as ReturnType<typeof jest.fn>).mockResolvedValueOnce(2);
    await expect(
      assertAutomationRuleAllowed(prisma as unknown as PrismaService, "t1"),
    ).resolves.toMatchObject({ maxAutomationRules: 3 });
  });

  it("refuses the 4th rule on FREE with 403", async () => {
    const prisma = fakePrisma();
    (prisma.organisation.findUnique as unknown as ReturnType<typeof jest.fn>).mockResolvedValueOnce({
      plan: "FREE",
    });
    (prisma.automationRule.count as unknown as ReturnType<typeof jest.fn>).mockResolvedValueOnce(3);
    await expect(
      assertAutomationRuleAllowed(prisma as unknown as PrismaService, "t1"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows unlimited rules on BUSINESS", async () => {
    const prisma = fakePrisma();
    (prisma.organisation.findUnique as unknown as ReturnType<typeof jest.fn>).mockResolvedValueOnce({
      plan: "BUSINESS",
    });
    (prisma.automationRule.count as unknown as ReturnType<typeof jest.fn>).mockResolvedValueOnce(500);
    await expect(
      assertAutomationRuleAllowed(prisma as unknown as PrismaService, "t1"),
    ).resolves.toMatchObject({ maxAutomationRules: null });
  });
});

describe("BillingService.getPlan", () => {
  it("returns the plan, an active trial and the feature limits", async () => {
    const prisma = fakePrisma();
    const trialEndsAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    (prisma.organisation.findUnique as unknown as ReturnType<typeof jest.fn>).mockResolvedValueOnce({
      id: "t1",
      plan: "STARTER",
      planStartedAt: new Date(),
      trialEndsAt,
    });
    const status = await new BillingService(prisma as unknown as PrismaService).getPlan("t1");
    expect(status.plan).toBe("STARTER");
    expect(status.trialActive).toBe(true);
    expect(status.trialDaysRemaining).toBe(10);
    expect(status.pricePkrPerUserPerMonth).toBe(1500);
    expect(status.features.maxAutomationRules).toBe(10);
  });

  it("reports no trial on FREE", async () => {
    const prisma = fakePrisma();
    (prisma.organisation.findUnique as unknown as ReturnType<typeof jest.fn>).mockResolvedValueOnce({
      id: "t1",
      plan: "FREE",
      planStartedAt: null,
      trialEndsAt: null,
    });
    const status = await new BillingService(prisma as unknown as PrismaService).getPlan("t1");
    expect(status.trialActive).toBe(false);
    expect(status.trialDaysRemaining).toBeNull();
  });

  it("throws 404 for an unknown organisation", async () => {
    const prisma = fakePrisma();
    await expect(
      new BillingService(prisma as unknown as PrismaService).getPlan("missing"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("BillingService.setPlan", () => {
  it("sets a paid plan, starts a 14-day trial and audits before/after", async () => {
    const prisma = fakePrisma();
    (prisma.organisation.findUnique as unknown as ReturnType<typeof jest.fn>)
      .mockResolvedValueOnce({ id: "t1", plan: "FREE" }) // setPlan lookup
      .mockResolvedValueOnce({
        id: "t1",
        plan: "GROWTH",
        planStartedAt: new Date(),
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      }); // getPlan re-read
    const status = await new BillingService(prisma as unknown as PrismaService).setPlan(
      "t1",
      "GROWTH",
      "owner-user",
    );
    expect(status.plan).toBe("GROWTH");
    expect(prisma.organisation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "t1" },
        data: expect.objectContaining({ plan: "GROWTH" }),
      }),
    );
    const updateData = (
      prisma.organisation.update as unknown as { mock: { calls: { data: { trialEndsAt: Date } }[][] } }
    ).mock.calls[0]?.[0]?.data;
    const trialDays = (updateData.trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(trialDays).toBeGreaterThan(13.9);
    expect(trialDays).toBeLessThanOrEqual(14);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "billing.plan_changed",
          metadata: expect.objectContaining({
            before: { plan: "FREE" },
            after: expect.objectContaining({ plan: "GROWTH" }),
          }),
        }),
      }),
    );
  });

  it("clears the trial when setting FREE", async () => {
    const prisma = fakePrisma();
    (prisma.organisation.findUnique as unknown as ReturnType<typeof jest.fn>)
      .mockResolvedValueOnce({ id: "t1", plan: "STARTER" })
      .mockResolvedValueOnce({
        id: "t1",
        plan: "FREE",
        planStartedAt: new Date(),
        trialEndsAt: null,
      });
    await new BillingService(prisma as unknown as PrismaService).setPlan("t1", "FREE", "owner-user");
    expect(prisma.organisation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ plan: "FREE", trialEndsAt: null }) }),
    );
  });

  it("rejects an unknown plan with 400", async () => {
    const prisma = fakePrisma();
    await expect(
      new BillingService(prisma as unknown as PrismaService).setPlan("t1", "ULTIMATE", "owner-user"),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.organisation.update).not.toHaveBeenCalled();
  });
});
