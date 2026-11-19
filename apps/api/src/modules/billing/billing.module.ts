import { Module } from "@nestjs/common";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { PrismaService } from "../../prisma/prisma.service";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";

/**
 * Billing module — plan read/set + the per-plan feature map
 * (billing/plan-features.ts). Foundation only: no payment provider
 * is wired in. Stripe Checkout is the post-funding provider; when
 * it lands it calls BillingService.setPlan from its webhook.
 *
 * Wiring: import { BillingModule } from "./modules/billing/billing.module"
 * in AppModule imports.
 */
@Module({
  controllers: [BillingController],
  providers: [BillingService, PrismaService, PermissionsGuard],
  exports: [BillingService],
})
export class BillingModule {}
