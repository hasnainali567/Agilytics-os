import { BadRequestException, Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Prisma } from "@prisma/client";
import { createSprintSchema } from "@agilytics/shared";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { TenantId } from "../../common/decorators/tenant.decorator";
import { PrismaService } from "../../prisma/prisma.service";
import { SprintsService } from "./sprints.service";

type ReqUser = { user?: { id?: string } };

@ApiTags("sprints")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("sprints")
export class SprintsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sprints: SprintsService,
  ) {}

  @ApiOperation({ summary: "List sprints" })
  @ApiResponse({ status: 200, description: "Success" })
  @Get()
  list(@TenantId() tenantId: string) {
    return this.prisma.sprint.findMany({ where: { tenantId }, orderBy: { startDate: "asc" } });
  }

  @ApiOperation({ summary: "Create sprints" })
  @ApiResponse({ status: 201, description: "Created" })
  @Post()
  async create(@TenantId() tenantId: string, @Req() req: ReqUser, @Body() body: unknown) {
    const parsed = createSprintSchema.parse(body);
    if (parsed.endDate <= parsed.startDate) {
      throw new BadRequestException("Sprint endDate must be after startDate");
    }
    const sprint = await this.prisma.sprint.create({
      data: {
        tenantId,
        projectId: parsed.projectId,
        name: parsed.name,
        goal: parsed.goal,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
      },
    });
    await this.audit(tenantId, req.user?.id, "sprint.created", "Sprint", sprint.id, {
      projectId: sprint.projectId,
      name: sprint.name,
    });
    return sprint;
  }

  @Post(":id/start")
  @RequirePermissions("SPRINTS_MANAGE")
  @ApiOperation({ summary: "Start a sprint (PLANNED → ACTIVE)" })
  @ApiResponse({ status: 201, description: "Sprint started" })
  @ApiResponse({ status: 400, description: "Sprint is not PLANNED" })
  @ApiResponse({ status: 404, description: "Sprint not found in this tenant" })
  start(@TenantId() tenantId: string, @Req() req: ReqUser, @Param("id") id: string) {
    return this.sprints.start(tenantId, id, req.user?.id ?? "unknown");
  }

  @Post(":id/complete")
  @RequirePermissions("SPRINTS_MANAGE")
  @ApiOperation({ summary: "Complete a sprint (fires the sprint.completed automation event)" })
  @ApiResponse({ status: 201, description: "Sprint completed" })
  @ApiResponse({ status: 400, description: "Sprint is already completed" })
  @ApiResponse({ status: 404, description: "Sprint not found in this tenant" })
  complete(@TenantId() tenantId: string, @Req() req: ReqUser, @Param("id") id: string) {
    return this.sprints.complete(tenantId, id, req.user?.id ?? "unknown");
  }

  /** Same audit() shape as RolesService — one AuditLog row per mutation. */
  private audit(
    tenantId: string,
    userId: string | undefined,
    action: string,
    entity: string,
    entityId: string,
    metadata: Record<string, unknown>,
  ) {
    return this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action,
        entity,
        entityId,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }
}
