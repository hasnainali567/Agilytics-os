import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { createAutomationRuleSchema, updateAutomationRuleSchema } from "@agilytics/shared";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import {
  RequireAnyPermission,
  RequirePermissions,
} from "../../common/decorators/require-permissions.decorator";
import { TenantId } from "../../common/decorators/tenant.decorator";
import { AutomationService } from "./automation.service";

type ReqUser = { user?: { id?: string } };

/**
 * Automation rules — trigger → action (Phase 2).
 *
 * Permission choice (documented): there is an existing catalog key
 * AUTOMATIONS_MANAGE ("Create and manage automation rules",
 * integrations area) — OWNER / ADMIN hold it, LEAD / MEMBER / VIEWER
 * do not. Mutations + the overdue sweep require it. Listing is
 * readable by anyone who can connect an integration
 * (AUTOMATIONS_MANAGE or INTEGRATIONS_CONNECT — MEMBER holds the
 * latter, so members can see what will notify them, but cannot change
 * rules). No new permission key was added: adding one needs a Prisma
 * enum value + migration, out of scope for this slice.
 *
 * Triggers `comment.created` and `sprint.completed` are valid in the
 * catalog but have no event site yet — there is no comments endpoint
 * and no sprint-complete endpoint in this slice, so nothing emits
 * them. Rules for them can be created; they simply never fire until
 * those endpoints land and emit on the automation bus.
 */
@ApiTags("automations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("integrations/automations")
export class AutomationsController {
  constructor(private readonly automations: AutomationService) {}

  @ApiOperation({ summary: "List automations" })
  @ApiResponse({ status: 200, description: "Success" })
  @Get()
  @RequireAnyPermission("AUTOMATIONS_MANAGE", "INTEGRATIONS_CONNECT")
  list(@TenantId() tenantId: string) {
    return this.automations.list(tenantId);
  }

  @ApiOperation({ summary: "Create automations" })
  @ApiResponse({ status: 201, description: "Created" })
  @Post()
  @RequirePermissions("AUTOMATIONS_MANAGE")
  create(@TenantId() tenantId: string, @Req() req: ReqUser, @Body() body: unknown) {
    const parsed = createAutomationRuleSchema.parse(body);
    return this.automations.create(tenantId, parsed, req.user?.id);
  }

  /**
   * Overdue sweep — finds tickets with no daily update in 3 days and
   * evaluates `ticket.overdue` rules for each. The worker / scheduler
   * calls this endpoint (see apps/worker JobsService `automation.run`).
   */
  @ApiOperation({ summary: "Sweep" })
  @ApiResponse({ status: 201, description: "Created" })
  @Post("sweep")
  @RequirePermissions("AUTOMATIONS_MANAGE")
  sweep(@TenantId() tenantId: string) {
    return this.automations.runSweep(tenantId);
  }

  @ApiOperation({ summary: "Update automations" })
  @ApiResponse({ status: 200, description: "Success" })
  @Patch(":id")
  @RequirePermissions("AUTOMATIONS_MANAGE")
  update(
    @TenantId() tenantId: string,
    @Req() req: ReqUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateAutomationRuleSchema.parse(body);
    return this.automations.update(tenantId, id, parsed, req.user?.id);
  }

  @ApiOperation({ summary: "Remove automations" })
  @ApiResponse({ status: 200, description: "Success" })
  @Delete(":id")
  @RequirePermissions("AUTOMATIONS_MANAGE")
  remove(@TenantId() tenantId: string, @Req() req: ReqUser, @Param("id") id: string) {
    return this.automations.remove(tenantId, id, req.user?.id);
  }

  @ApiOperation({ summary: "Toggle" })
  @ApiResponse({ status: 201, description: "Created" })
  @Post(":id/toggle")
  @RequirePermissions("AUTOMATIONS_MANAGE")
  toggle(@TenantId() tenantId: string, @Req() req: ReqUser, @Param("id") id: string) {
    return this.automations.toggle(tenantId, id, req.user?.id);
  }
}
