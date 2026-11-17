import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantId } from "../../common/decorators/tenant.decorator";
import { PrismaService } from "../../prisma/prisma.service";

/** Identity / tenants — users, organisations, memberships, roles. */
@ApiTags("identity")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("identity")
export class IdentityController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("me")
  async me(@TenantId() tenantId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { tenantId },
      include: { user: true, organisation: true },
    });
    return { tenantId, memberships };
  }
}
