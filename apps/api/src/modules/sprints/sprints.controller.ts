import { BadRequestException, Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { createSprintSchema } from "@agilytics/shared";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantId } from "../../common/decorators/tenant.decorator";
import { PrismaService } from "../../prisma/prisma.service";

@ApiTags("sprints")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("sprints")
export class SprintsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.prisma.sprint.findMany({ where: { tenantId }, orderBy: { startDate: "asc" } });
  }

  @Post()
  async create(@TenantId() tenantId: string, @Body() body: unknown) {
    const parsed = createSprintSchema.parse(body);
    if (parsed.endDate <= parsed.startDate) {
      throw new BadRequestException("Sprint endDate must be after startDate");
    }
    return this.prisma.sprint.create({
      data: {
        tenantId,
        projectId: parsed.projectId,
        name: parsed.name,
        goal: parsed.goal,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
      },
    });
  }
}
