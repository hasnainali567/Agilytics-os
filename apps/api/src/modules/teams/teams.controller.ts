import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Prisma } from "@prisma/client";
import { createTeamSchema } from "@agilytics/shared";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantId } from "../../common/decorators/tenant.decorator";
import { PrismaService } from "../../prisma/prisma.service";

type ReqUser = { user?: { id?: string } };

/** Teams / members — team rosters, per workspace. */
@ApiTags("teams")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("teams")
export class TeamsController {
  constructor(private readonly prisma: PrismaService) {}

  @ApiOperation({ summary: "List teams" })
  @ApiResponse({ status: 200, description: "Success" })
  @Get()
  list(@TenantId() tenantId: string) {
    return this.prisma.team.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } });
  }

  @ApiOperation({ summary: "Create teams" })
  @ApiResponse({ status: 201, description: "Created" })
  @Post()
  async create(@TenantId() tenantId: string, @Req() req: ReqUser, @Body() body: unknown) {
    const parsed = createTeamSchema.parse(body);
    const team = await this.prisma.team.create({ data: { tenantId, name: parsed.name } });
    await this.audit(tenantId, req.user?.id, "team.created", "Team", team.id, {
      name: team.name,
    });
    return team;
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
