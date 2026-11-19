import { Body, Controller, ForbiddenException, Get, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard, loadEffectivePermissions } from "../../common/guards/permissions.guard";
import { RequireAnyPermission } from "../../common/decorators/require-permissions.decorator";
import { TenantId } from "../../common/decorators/tenant.decorator";
import { PrismaService } from "../../prisma/prisma.service";
import { BillingService } from "./billing.service";
import { PLAN_NAMES } from "./plan-features";

type ReqUser = { user?: { id?: string }; platformRole?: string };

const setPlanSchema = z.object({
  plan: z.enum(PLAN_NAMES),
});

/**
 * Billing — plan read + plan set (foundation only, 2026-11-19).
 *
 * GET is readable by anyone with BILLING_VIEW (OWNER / ADMIN hold it).
 * POST is PLATFORM_ADMIN or workspace OWNER (BILLING_MANAGE — only
 * OWNER holds it among the system roles). That OR cannot be expressed
 * by stacking guards (both would have to pass), so it is checked in
 * the handler: platformRole from the JWT first, else the caller's
 * effective permissions. This endpoint is NOT a purchase — it sets
 * the plan directly, for admins and tests. Stripe Checkout is the
 * post-funding provider; no Stripe keys or paid calls exist yet.
 */
@ApiTags("billing")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("billing")
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly prisma: PrismaService,
  ) {}

  @Get("plan")
  @RequireAnyPermission("BILLING_VIEW", "BILLING_MANAGE")
  @ApiOperation({ summary: "Current plan, trial status and feature limits for this workspace" })
  @ApiResponse({ status: 200, description: "Plan status with per-plan feature limits" })
  @ApiResponse({ status: 404, description: "Organisation not found" })
  getPlan(@TenantId() tenantId: string) {
    return this.billing.getPlan(tenantId);
  }

  @Post("plan")
  @ApiOperation({
    summary: "Set the workspace plan (platform admin or workspace OWNER only — NOT a purchase)",
    description:
      "Admin/test endpoint: sets the plan directly and (re)starts a 14-day trial on paid plans. " +
      "Stripe Checkout is the post-funding provider and will call the same path from its webhook.",
  })
  @ApiResponse({ status: 200, description: "Updated plan status" })
  @ApiResponse({ status: 400, description: "Unknown plan value" })
  @ApiResponse({ status: 403, description: "Caller is neither platform admin nor workspace OWNER" })
  @ApiResponse({ status: 404, description: "Organisation not found" })
  async setPlan(@TenantId() tenantId: string, @Req() req: ReqUser, @Body() body: unknown) {
    const userId = req.user?.id ?? "unknown";
    if (req.platformRole !== "PLATFORM_ADMIN") {
      const permissions = await loadEffectivePermissions(this.prisma, tenantId, userId);
      if (!permissions.includes("BILLING_MANAGE")) {
        throw new ForbiddenException(
          "Setting the plan requires PLATFORM_ADMIN or the workspace OWNER (BILLING_MANAGE)",
        );
      }
    }
    const parsed = setPlanSchema.parse(body);
    return this.billing.setPlan(tenantId, parsed.plan, userId);
  }
}
