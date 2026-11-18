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
    // Project key: first letters of the name's words, e.g. "Engineering"
    // -> ENG, "Mobile App" -> MA. Unique per tenant; append a number on
    // conflict. Ticket keys are built from this (ENG-123).
    const baseKey =
      parsed.name
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .replace(/[^A-Za-z]/g, "")
        .toUpperCase()
        .slice(0, 4) || "PRJ";
    let key = baseKey;
    for (let n = 2; ; n += 1) {
      const existing = await this.prisma.project.findFirst({
        where: { tenantId, key },
        select: { id: true },
      });
      if (!existing) break;
      key = `${baseKey}${n}`;
    }
    return this.prisma.project.create({
      data: {
        tenantId,
        key,
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
