import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { createTeamSchema } from "@agilytics/shared";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantId } from "../../common/decorators/tenant.decorator";
import { PrismaService } from "../../prisma/prisma.service";

/** Teams / members — team rosters, per workspace. */
@ApiTags("teams")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("teams")
export class TeamsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.prisma.team.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } });
  }

  @Post()
  create(@TenantId() tenantId: string, @Body() body: unknown) {
    const parsed = createTeamSchema.parse(body);
    return this.prisma.team.create({ data: { tenantId, name: parsed.name } });
  }
}
