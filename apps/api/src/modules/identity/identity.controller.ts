import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { loadEffectivePermissions } from "../../common/guards/permissions.guard";
import { TenantId } from "../../common/decorators/tenant.decorator";
import { PrismaService } from "../../prisma/prisma.service";

type ReqUser = { user?: { id?: string } };

/** Identity / tenants — users, organisations, memberships, roles. */
@ApiTags("identity")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("identity")
export class IdentityController {
  constructor(private readonly prisma: PrismaService) {}

  @ApiOperation({ summary: "Me" })
  @ApiResponse({ status: 200, description: "Success" })
  @Get("me")
  async me(@TenantId() tenantId: string, @Req() req: ReqUser) {
    const memberships = await this.prisma.membership.findMany({
      where: { tenantId },
      include: { user: true, organisation: true },
    });
    // Caller's own effective permission set (decision 21): resolved
    // from their Membership → Role → RolePermission rows, so the web
    // can hide UI the caller lacks. Hiding is cosmetic — the API
    // enforces via PermissionsGuard.
    const userId = req.user?.id;
    const me = userId
      ? await this.prisma.membership
          .findFirst({
            where: { tenantId, userId },
            include: { roleRef: { select: { id: true, name: true, isSystem: true } } },
          })
          .then(async (membership) => ({
            userId,
            roleId: membership?.roleId ?? null,
            roleName: membership?.roleRef?.name ?? membership?.role ?? null,
            permissions: await loadEffectivePermissions(this.prisma, tenantId, userId),
          }))
      : { userId: null, roleId: null, roleName: null, permissions: [] as string[] };
    return { tenantId, memberships, me };
  }
}
