import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { DEFAULT_BOARD_TEMPLATE, createProjectSchema } from "@agilytics/shared";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantId } from "../../common/decorators/tenant.decorator";
import { PrismaService } from "../../prisma/prisma.service";

@ApiTags("projects")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("projects")
export class ProjectsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.prisma.project.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
  }

  @Post()
  async create(@TenantId() tenantId: string, @Body() body: unknown) {
    const parsed = createProjectSchema.parse(body);
    // A project is born with its default board (Backlog / To Do /
    // In Progress / Review / Done) — a starting template only; the
    // workspace admin can rename, reorder, add or remove columns freely
    // (see docs/WORKFLOWS.md). The template lives in @agilytics/shared
    // so the web can preview it without an API call.
    return this.prisma.project.create({
      data: {
        tenantId,
        name: parsed.name,
        description: parsed.description,
        boards: {
          create: {
            tenantId,
            name: "Main board",
            isDefault: true,
            columns: {
              create: DEFAULT_BOARD_TEMPLATE.map((c, i) => ({ ...c, tenantId, order: i })),
            },
          },
        },
      },
      include: { boards: { include: { columns: { orderBy: { order: "asc" } } } } },
    });
  }
}
