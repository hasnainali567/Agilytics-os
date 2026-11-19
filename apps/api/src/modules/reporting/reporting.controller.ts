import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantId } from "../../common/decorators/tenant.decorator";
import { ReportingService } from "./reporting.service";

@ApiTags("reporting")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("reporting")
export class ReportingController {
  constructor(private readonly reporting: ReportingService) {}

  @Get("dashboard-summary")
  dashboardSummary(@TenantId() tenantId: string) {
    return this.reporting.dashboardSummary(tenantId);
  }

  /** Time report — total hours + top members/tickets, per sprint, per project, or workspace-wide. */
  @Get("time")
  timeTotals(
    @TenantId() tenantId: string,
    @Query("sprintId") sprintId?: string,
    @Query("projectId") projectId?: string,
  ) {
    return this.reporting.timeTotals(tenantId, { sprintId, projectId });
  }
}
