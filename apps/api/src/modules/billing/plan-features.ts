import { ForbiddenException } from "@nestjs/common";
import type { PrismaService } from "../../prisma/prisma.service";

/**
 * Plan features — the per-plan limits and feature gates (billing
 * foundation, 2026-11-19).
 *
 * Prices are the locked DECISION-SHEET.md Q1 tiers (PKR per user per
 * month): STARTER 1,500 / GROWTH 2,500 / BUSINESS 4,000; ENTERPRISE
 * custom; every paid plan starts with a 14-day free trial. The AI
 * spend cap is the Q4 default ($20 / workspace / month, adjustable
 * per plan). Storage limits are the Q12 proposals (Starter 5 GB,
 * Growth 20 GB, Business 100 GB).
 *
 * Limits live HERE, in code — never in the database — so a plan
 * change is a data update (POST /billing/plan), never a migration.
 * Enforcement is server-side on the relevant mutation: today that is
 * automation-rule creation (FREE gets a small cap); integrations,
 * realtime and AI read the same map when their mutations land.
 *
 * NO live Stripe: there are no keys, no paid calls, no checkout
 * session anywhere in this module. Stripe Checkout is the
 * post-funding provider — when it lands, it calls the same
 * `setPlan` path after a successful checkout webhook, and this map
 * is the source of truth for what the paid plan unlocks.
 */

export type PlanName = "FREE" | "STARTER" | "GROWTH" | "BUSINESS" | "ENTERPRISE";

export const PLAN_NAMES: PlanName[] = ["FREE", "STARTER", "GROWTH", "BUSINESS", "ENTERPRISE"];

export function isPlan(value: unknown): value is PlanName {
  return typeof value === "string" && (PLAN_NAMES as string[]).includes(value);
}

/** 14-day free trial on every paid plan (DECISION-SHEET.md Q1). */
export const TRIAL_DAYS = 14;

export interface PlanFeatures {
  /** PKR per user per month; null = custom (Enterprise). */
  pricePkrPerUserPerMonth: number | null;
  /** Max automation rules; null = unlimited. */
  maxAutomationRules: number | null;
  /** Max connected integrations; null = unlimited. */
  maxIntegrations: number | null;
  /** Realtime (WebSocket gateway / SSE feed) available. */
  realtime: boolean;
  /** AI features available (still under the workspace spend cap). */
  ai: boolean;
  /** Monthly AI spend cap in USD; null = custom / no fixed cap. */
  aiMonthlyCapUsd: number | null;
  /** Doc-upload storage per workspace, GB; null = unlimited. */
  storageGb: number | null;
  /** SAML/OIDC SSO (Enterprise only, Q3). */
  sso: boolean;
}

export const PLAN_FEATURES: Record<PlanName, PlanFeatures> = {
  FREE: {
    pricePkrPerUserPerMonth: 0,
    maxAutomationRules: 3,
    maxIntegrations: 1,
    realtime: false,
    ai: false,
    aiMonthlyCapUsd: null,
    storageGb: 1,
    sso: false,
  },
  STARTER: {
    pricePkrPerUserPerMonth: 1500,
    maxAutomationRules: 10,
    maxIntegrations: 3,
    realtime: true,
    ai: true,
    aiMonthlyCapUsd: 20,
    storageGb: 5,
    sso: false,
  },
  GROWTH: {
    pricePkrPerUserPerMonth: 2500,
    maxAutomationRules: 25,
    maxIntegrations: 10,
    realtime: true,
    ai: true,
    aiMonthlyCapUsd: 20,
    storageGb: 20,
    sso: false,
  },
  BUSINESS: {
    pricePkrPerUserPerMonth: 4000,
    maxAutomationRules: null,
    maxIntegrations: null,
    realtime: true,
    ai: true,
    aiMonthlyCapUsd: 50,
    storageGb: 100,
    sso: false,
  },
  ENTERPRISE: {
    pricePkrPerUserPerMonth: null,
    maxAutomationRules: null,
    maxIntegrations: null,
    realtime: true,
    ai: true,
    aiMonthlyCapUsd: null,
    storageGb: null,
    sso: true,
  },
};

export function getPlanFeatures(plan: PlanName): PlanFeatures {
  return PLAN_FEATURES[plan];
}

/** Minimal Prisma surface the cap helpers need (keeps them unit-testable). */
export type PlanPrisma = Pick<PrismaService, "organisation" | "automationRule">;

export async function getOrganisationPlan(
  prisma: Pick<PrismaService, "organisation">,
  tenantId: string,
): Promise<PlanName> {
  const org = await prisma.organisation.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  });
  return (org?.plan as PlanName | undefined) ?? "FREE";
}

/**
 * Enforce the plan's automation-rule cap before creating a rule.
 * FREE allows 3 rules; paid plans allow more (BUSINESS / ENTERPRISE
 * unlimited). Throws 403 with the cap and the current plan so the
 * caller can tell the user to upgrade. Called from
 * AutomationService.create — the seed writes rules directly, so it
 * is not capped.
 */
export async function assertAutomationRuleAllowed(
  prisma: PlanPrisma,
  tenantId: string,
): Promise<PlanFeatures> {
  const plan = await getOrganisationPlan(prisma, tenantId);
  const features = getPlanFeatures(plan);
  if (features.maxAutomationRules === null) return features;
  const count = await prisma.automationRule.count({ where: { tenantId } });
  if (count >= features.maxAutomationRules) {
    throw new ForbiddenException(
      `Plan ${plan} allows ${features.maxAutomationRules} automation rules (currently ${count}) — upgrade the plan to create more`,
    );
  }
  return features;
}
