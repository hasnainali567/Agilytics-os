import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  TRIAL_DAYS,
  getPlanFeatures,
  isPlan,
  type PlanFeatures,
  type PlanName,
} from "./plan-features";

export interface PlanStatus {
  tenantId: string;
  plan: PlanName;
  planStartedAt: Date | null;
  trialEndsAt: Date | null;
  trialActive: boolean;
  trialDaysRemaining: number | null;
  pricePkrPerUserPerMonth: number | null;
  features: PlanFeatures;
}

/**
 * Billing — plan read + plan set (foundation only, 2026-11-19).
 *
 * There is NO payment provider wired in: no Stripe keys, no paid
 * calls, no checkout. POST /billing/plan is an admin/test endpoint
 * (platform admin or workspace OWNER) that sets the plan directly;
 * Stripe Checkout is the post-funding provider and will call this
 * same `setPlan` path from its webhook after a successful payment.
 *
 * Setting a paid plan starts a fresh 14-day trial (trialEndsAt =
 * now + 14d); setting FREE clears the trial. Re-setting the same
 * paid plan restarts the trial — acceptable for an admin endpoint,
 * and recorded in the audit log.
 */
@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlan(tenantId: string): Promise<PlanStatus> {
    const org = await this.prisma.organisation.findUnique({
      where: { id: tenantId },
      select: { id: true, plan: true, planStartedAt: true, trialEndsAt: true },
    });
    if (!org) throw new NotFoundException("Organisation not found");
    const plan = org.plan as PlanName;
    const now = new Date();
    const trialActive =
      plan !== "FREE" && org.trialEndsAt !== null && org.trialEndsAt.getTime() > now.getTime();
    const trialDaysRemaining = trialActive && org.trialEndsAt
      ? Math.max(
          0,
          Math.ceil((org.trialEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
        )
      : null;
    const features = getPlanFeatures(plan);
    return {
      tenantId: org.id,
      plan,
      planStartedAt: org.planStartedAt,
      trialEndsAt: org.trialEndsAt,
      trialActive,
      trialDaysRemaining,
      pricePkrPerUserPerMonth: features.pricePkrPerUserPerMonth,
      features,
    };
  }

  async setPlan(tenantId: string, planInput: unknown, actorId: string): Promise<PlanStatus> {
    if (!isPlan(planInput)) {
      throw new BadRequestException(
        `Unknown plan: ${String(planInput)} — expected one of FREE, STARTER, GROWTH, BUSINESS, ENTERPRISE`,
      );
    }
    const plan = planInput as PlanName;
    const org = await this.prisma.organisation.findUnique({
      where: { id: tenantId },
      select: { id: true, plan: true },
    });
    if (!org) throw new NotFoundException("Organisation not found");
    const now = new Date();
    const trialEndsAt =
      plan === "FREE" ? null : new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    await this.prisma.organisation.update({
      where: { id: tenantId },
      data: { plan, planStartedAt: now, trialEndsAt },
    });
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        action: "billing.plan_changed",
        entity: "Organisation",
        entityId: tenantId,
        metadata: { before: { plan: org.plan }, after: { plan, trialEndsAt } } as Prisma.InputJsonValue,
      },
    });
    return this.getPlan(tenantId);
  }
}
