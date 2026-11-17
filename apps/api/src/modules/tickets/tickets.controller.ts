import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { createTicketSchema, updateTicketStatusSchema } from "@agilytics/shared";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantId } from "../../common/decorators/tenant.decorator";
import { TicketsService } from "./tickets.service";

@ApiTags("tickets")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("tickets")
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get()
  list(@TenantId() tenantId: string, @Query("projectId") projectId?: string) {
    return this.tickets.list(tenantId, projectId);
  }

  @Post()
  create(@TenantId() tenantId: string, @Body() body: unknown) {
    const parsed = createTicketSchema.parse(body);
    return this.tickets.create(tenantId, parsed);
  }

  @Patch(":id/status")
  changeStatus(
    @TenantId() tenantId: string,
    @Req() req: { user?: { id?: string } },
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateTicketStatusSchema.parse(body);
    return this.tickets.changeStatus(tenantId, id, parsed.statusId, req.user?.id, parsed.note);
  }
}
