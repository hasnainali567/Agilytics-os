import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { ProviderKind } from "./providers/provider.interface";
import { ProviderRegistry } from "./providers/registry";
import { SlackProvider } from "./providers/slack.provider";

/**
 * Integrations service — connect/disconnect + audit, thin Slack posting.
 * Every connect / disconnect / import is written to AuditLog (tenant
 * scoped); tokens are never logged and never returned.
 *
 * OAuth tokens: Phase 1 stores NO real token. connect() upserts the
 * Integration row with the placeholder `__TODO_KMS_ENCRYPTED__` so the
 * connection is visible in the hub; the live flow (exchange code →
 * KMS-encrypt → store) is a TODO in the providers. Nothing here should
 * be mistaken for a stored credential.
 */
@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ProviderRegistry,
    private readonly slack: SlackProvider,
  ) {}

  async list(tenantId: string) {
    const connected = await this.prisma.integration.findMany({
      where: { tenantId },
      select: { id: true, provider: true, isActive: true, createdAt: true },
    });
    return { available: this.registry.list(), connected };
  }

  async connect(tenantId: string, providerKind: ProviderKind, code: string, userId?: string) {
    const provider = this.registry.get(providerKind);
    if (!provider) return { status: "not_available" as const, provider: providerKind };
    await provider.connect(tenantId, code);
    await this.prisma.integration.upsert({
      where: { tenantId_provider: { tenantId, provider: providerKind } },
      update: { isActive: true },
      // TODO (live OAuth): store the KMS-encrypted token here, not a placeholder.
      create: {
        tenantId,
        provider: providerKind,
        encryptedCredentials: "__TODO_KMS_ENCRYPTED__",
        isActive: true,
      },
    });
    await this.audit(
      tenantId,
      "integration.connect",
      "Integration",
      providerKind,
      { provider: providerKind },
      userId,
    );
    return { status: "connect_started" as const, provider: providerKind };
  }

  async disconnect(tenantId: string, providerKind: ProviderKind, userId?: string) {
    const provider = this.registry.get(providerKind);
    if (!provider) return { status: "not_available" as const, provider: providerKind };
    await provider.disconnect(tenantId);
    await this.prisma.integration.updateMany({
      where: { tenantId, provider: providerKind },
      data: { isActive: false },
    });
    await this.audit(
      tenantId,
      "integration.disconnect",
      "Integration",
      providerKind,
      { provider: providerKind },
      userId,
    );
    return { status: "disconnected" as const, provider: providerKind };
  }

  /** Post a message via Slack — throws a clear error while unconfigured. */
  async postToSlack(channel: string, text: string) {
    await this.slack.postMessage(channel, text);
    return { status: "posted" as const, channel };
  }

  async audit(
    tenantId: string,
    action: string,
    entity: string,
    entityId: string | undefined,
    metadata: Prisma.InputJsonValue,
    userId?: string,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: { tenantId, userId, action, entity, entityId, metadata },
      });
    } catch (err) {
      // Audit must never break the user-facing action.
      this.logger.warn(`Audit log write failed (${action}): ${(err as Error).message}`);
    }
  }
}
