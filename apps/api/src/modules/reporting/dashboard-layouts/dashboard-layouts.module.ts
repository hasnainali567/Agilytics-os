import { Module } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { DashboardLayoutsController } from "./dashboard-layouts.controller";
import { DashboardLayoutsService } from "./dashboard-layouts.service";

@Module({
  controllers: [DashboardLayoutsController],
  providers: [DashboardLayoutsService, PrismaService],
})
export class DashboardLayoutsModule {}

/*
 * WIRING (not applied — app.module.ts is owned by the coordinator):
 * add these 3 lines to apps/api/src/app.module.ts:
 *
 *   import { DashboardLayoutsModule } from "./modules/reporting/dashboard-layouts/dashboard-layouts.module";
 *   // ... in the @Module imports array, alongside ReportingModule:
 *   DashboardLayoutsModule,
 *
 * That is the whole wiring: the module brings its own controller,
 * service and PrismaService, and mounts GET/PUT /dashboard/layout
 * and POST /dashboard/layout/reset under the /api/v1 prefix.
 */
