import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { createDailyUpdateSchema } from "@agilytics/shared";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantId } from "../../common/decorators/tenant.decorator";
import { DailyUpdatesService } from "./daily-updates.service";

type ReqUser = { user?: { id?: string } };

/**
 * Daily updates — per ticket, per member, per day. One update per
 * member per ticket per day (upsert). See docs/WORKFLOWS.md.
 */
@ApiTags("daily-updates")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class DailyUpdatesController {
  constructor(private readonly updates: DailyUpdatesService) {}

  @ApiOperation({ summary: "Upsert today" })
  @ApiResponse({ status: 201, description: "Created" })
  @Post("tickets/:ticketId/daily-updates")
  upsertToday(
    @TenantId() tenantId: string,
    @Req() req: ReqUser,
    @Param("ticketId") ticketId: string,
    @Body() body: unknown,
  ) {
    const parsed = createDailyUpdateSchema.parse(body);
    return this.updates.upsertToday(tenantId, req.user?.id ?? "unknown", ticketId, parsed);
  }

  @ApiOperation({ summary: "Timeline" })
  @ApiResponse({ status: 200, description: "Success" })
  @Get("tickets/:ticketId/daily-updates")
  timeline(@TenantId() tenantId: string, @Param("ticketId") ticketId: string) {
    return this.updates.timeline(tenantId, ticketId);
  }

  @ApiOperation({ summary: "Today" })
  @ApiResponse({ status: 200, description: "Success" })
  @Get("daily-updates/today")
  today(@TenantId() tenantId: string) {
    return this.updates.todayFeed(tenantId);
  }

  @ApiOperation({ summary: "Blockers" })
  @ApiResponse({ status: 200, description: "Success" })
  @Get("daily-updates/blockers")
  blockers(@TenantId() tenantId: string, @Query("projectId") projectId?: string) {
    return this.updates.blockers(tenantId, projectId);
  }
}
