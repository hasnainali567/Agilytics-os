import { Body, Controller, Get, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { TenantId } from "../../../common/decorators/tenant.decorator";
import { DashboardLayoutsService } from "./dashboard-layouts.service";
import {
  resetLayoutSchema,
  roleTemplates,
  saveLayoutSchema,
  type RoleTemplate,
} from "./dashboard-layout.schema";

/**
 * Per-user dashboard layouts (decision 20, FRONTEND.md §1B).
 * Routes: GET /dashboard/layout, PUT /dashboard/layout,
 * POST /dashboard/layout/reset. The caller is identified by the JWT
 * (req.user.id, set by JwtAuthGuard) — userId is never taken from the
 * request body or query, so one user cannot read or overwrite
 * another user's layout.
 *
 * NOT WIRED YET — see dashboard-layouts.module.ts for the snippet
 * that registers DashboardLayoutsModule in AppModule.
 */
@ApiTags("dashboard")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("dashboard")
export class DashboardLayoutsController {
  constructor(private readonly layouts: DashboardLayoutsService) {}

  @Get("layout")
  getLayout(
    @TenantId() tenantId: string,
    @Req() req: { user?: { id?: string } },
    @Query("name") name?: string,
    @Query("template") template?: string,
  ) {
    const validTemplate = (roleTemplates as readonly string[]).includes(template ?? "")
      ? (template as RoleTemplate)
      : undefined;
    return this.layouts.getLayout(tenantId, req.user?.id ?? "unknown", {
      name,
      template: validTemplate,
    });
  }

  @Put("layout")
  saveLayout(
    @TenantId() tenantId: string,
    @Req() req: { user?: { id?: string } },
    @Body() body: unknown,
  ) {
    const parsed = saveLayoutSchema.parse(body);
    return this.layouts.saveLayout(tenantId, req.user?.id ?? "unknown", parsed);
  }

  @Post("layout/reset")
  resetLayout(
    @TenantId() tenantId: string,
    @Req() req: { user?: { id?: string } },
    @Body() body: unknown,
  ) {
    const parsed = resetLayoutSchema.parse(body ?? {});
    return this.layouts.resetLayout(tenantId, req.user?.id ?? "unknown", parsed);
  }
}
