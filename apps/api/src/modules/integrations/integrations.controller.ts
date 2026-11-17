import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantId } from "../../common/decorators/tenant.decorator";
import { PrismaService } from "../../prisma/prisma.service";
import type { ProviderKind } from "./providers/provider.interface";
import { ProviderRegistry } from "./providers/registry";

/**
 * Integrations / automations — Connections hub.
 * Lists connected providers for the workspace. OAuth tokens are stored
 * encrypted with KMS (see SECURITY.md) and are never returned here.
 * Full catalog: docs/INTEGRATIONS.md.
 */
@ApiTags("integrations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("integrations")
export class IntegrationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ProviderRegistry,
  ) {}

  @Get()
  async list(@TenantId() tenantId: string) {
    const connected = await this.prisma.integration.findMany({
      where: { tenantId },
      select: { id: true, provider: true, isActive: true, createdAt: true },
    });
    return { available: this.registry.list(), connected };
  }

  @Post(":provider/connect")
  connect(@TenantId() tenantId: string, @Body() body: { provider: ProviderKind; code: string }) {
    const provider = this.registry.get(body.provider);
    if (!provider) {
      return { status: "not_available", provider: body.provider };
    }
    return provider.connect(tenantId, body.code).then(() => ({ status: "connect_started" }));
  }

  @Post(":provider/webhook")
  webhook(
    @TenantId() tenantId: string,
    @Body() body: { provider: ProviderKind; payload: unknown },
  ) {
    const provider = this.registry.get(body.provider);
    if (!provider) {
      return { status: "not_available" };
    }
    // TODO: verify the provider's webhook signature before dispatching.
    return provider.handleWebhook(tenantId, body.payload).then(() => ({ status: "received" }));
  }
}
