import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { normalizeProviderKind } from "./credential-store.service";
import { getOAuthStateSecret, verifyOAuthState } from "./oauth-state";
import type { ProviderKind } from "./providers/provider.interface";
import { ProviderRegistry } from "./providers/registry";
import { GitHubProvider } from "./providers/github.provider";
import { GoogleProvider } from "./providers/google.provider";
import { NotionProvider } from "./providers/notion.provider";
import { SlackProvider } from "./providers/slack.provider";
import { WebhookProvider, type IncomingTicketPayload } from "./providers/webhook.provider";

/** Env vars a provider needs before its authorize URL can be built. */
const OAUTH_ENV: Partial<Record<ProviderKind, string>> = {
  SLACK: "SLACK_CLIENT_ID / SLACK_CLIENT_SECRET",
  GITHUB: "GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET",
  NOTION: "NOTION_CLIENT_ID / NOTION_CLIENT_SECRET",
  GOOGLE_CALENDAR: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET",
  GOOGLE: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET",
};

/**
 * Integrations service — connect/disconnect + audit, thin Slack/GitHub
 * posting, OAuth authorize/callback, Google/Notion/Webhook delegation.
 * Every connect / disconnect / import is written to AuditLog (tenant
 * scoped); tokens are never logged and never returned — providers store
 * them encrypted (TokenVault, AES placeholder until KMS) via
 * IntegrationCredentialStore, in `Integration.encryptedCredentials`.
 */
@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ProviderRegistry,
    private readonly slack: SlackProvider,
    private readonly github: GitHubProvider,
    private readonly notion: NotionProvider,
    private readonly google: GoogleProvider,
    private readonly webhook: WebhookProvider,
  ) {}

  async list(tenantId: string) {
    const connected = await this.prisma.integration.findMany({
      where: { tenantId },
      select: { id: true, provider: true, isActive: true, createdAt: true },
    });
    return { available: this.registry.list(), connected };
  }

  /**
   * Authorize URL for the OAuth flow. The web app calls this (authed)
   * and opens the returned URL in a new tab — the provider then
   * redirects the browser to the public callback. 503 when the provider
   * is not configured (missing client id/secret env vars).
   */
  authorizeUrl(tenantId: string, providerKind: ProviderKind): { authorizeUrl: string } {
    const provider = this.registry.get(providerKind);
    const url = provider?.authorizeUrl?.(tenantId) ?? null;
    if (!url) {
      const env = OAUTH_ENV[providerKind];
      throw new ServiceUnavailableException(
        env
          ? `${providerKind} is not configured — set ${env} (see docs/INTEGRATIONS.md).`
          : `${providerKind} has no OAuth flow.`,
      );
    }
    return { authorizeUrl: url };
  }

  /**
   * OAuth callback: verify the signed state (never trust a raw tenantId
   * from the query), exchange the code via the provider (tokens stored
   * encrypted), audit, and return the tenant the flow belongs to.
   */
  async handleOAuthCallback(
    providerKind: ProviderKind,
    code: string,
    state: string,
    userId?: string,
  ): Promise<{ tenantId: string }> {
    const provider = this.registry.get(providerKind);
    if (!provider) throw new Error(`Provider not available: ${providerKind}`);
    const tenantId = verifyOAuthState(state, getOAuthStateSecret());
    await provider.connect(tenantId, code);
    await this.audit(
      tenantId,
      "integration.connect",
      "Integration",
      normalizeProviderKind(providerKind),
      { provider: normalizeProviderKind(providerKind) },
      userId,
    );
    return { tenantId };
  }

  async connect(tenantId: string, providerKind: ProviderKind, code: string, userId?: string) {
    const provider = this.registry.get(providerKind);
    if (!provider) return { status: "not_available" as const, provider: providerKind };
    // The provider exchanges the code and stores the encrypted tokens
    // (no placeholder — see IntegrationCredentialStore).
    await provider.connect(tenantId, code);
    await this.audit(
      tenantId,
      "integration.connect",
      "Integration",
      normalizeProviderKind(providerKind),
      { provider: normalizeProviderKind(providerKind) },
      userId,
    );
    return { status: "connected" as const, provider: providerKind };
  }

  async disconnect(tenantId: string, providerKind: ProviderKind, userId?: string) {
    const provider = this.registry.get(providerKind);
    if (!provider) return { status: "not_available" as const, provider: providerKind };
    await provider.disconnect(tenantId);
    await this.prisma.integration.updateMany({
      where: { tenantId, provider: normalizeProviderKind(providerKind) as never },
      data: { isActive: false },
    });
    await this.audit(
      tenantId,
      "integration.disconnect",
      "Integration",
      normalizeProviderKind(providerKind),
      { provider: normalizeProviderKind(providerKind) },
      userId,
    );
    return { status: "disconnected" as const, provider: providerKind };
  }

  /** Post a message via Slack — uses the workspace token, else the env bot token. */
  async postToSlack(channel: string, text: string, tenantId?: string) {
    await this.slack.postMessage(channel, text, tenantId);
    return { status: "posted" as const, channel };
  }

  async listPullRequests(owner: string, repo: string, ticketKey?: string, tenantId?: string) {
    if (ticketKey) return this.github.listPullRequestsForTicket(owner, repo, ticketKey, tenantId);
    return this.github.listPullRequests(owner, repo, tenantId);
  }

  // ---- Notion (delegated, tenant-scoped) ----

  listNotionItems(tenantId: string) {
    return this.notion.listAccessible(tenantId);
  }

  listNotionLinks(tenantId: string) {
    return this.notion.listLinks(tenantId);
  }

  linkNotionItem(tenantId: string, itemId: string, projectId: string) {
    return this.notion.linkToProject(tenantId, itemId, projectId);
  }

  syncProvider(tenantId: string, providerKind: ProviderKind) {
    const provider = this.registry.get(providerKind);
    if (!provider) return { status: "not_available" as const, provider: providerKind };
    return provider.sync(tenantId).then(() => ({ status: "synced" as const, provider: providerKind }));
  }

  // ---- Google (delegated, tenant-scoped) ----

  listGoogleEvents(tenantId: string, maxResults = 10) {
    return this.google.listUpcomingEvents(tenantId, maxResults);
  }

  createGoogleEventFromSprint(tenantId: string, sprintId: string) {
    return this.google.createEventFromSprint(tenantId, sprintId);
  }

  listGmailMessages(tenantId: string, maxResults = 10) {
    return this.google.listRecentMessages(tenantId, maxResults);
  }

  createTicketFromEmail(tenantId: string, messageId: string, projectId: string, userId?: string) {
    return this.google.createTicketFromEmail(tenantId, messageId, projectId, userId);
  }

  listDriveFiles(tenantId: string, maxResults = 10) {
    return this.google.listDriveFiles(tenantId, maxResults);
  }

  attachDriveFile(tenantId: string, ticketId: string, fileId: string) {
    return this.google.attachDriveFileToTicket(tenantId, ticketId, fileId);
  }

  // ---- Generic webhook (delegated, tenant-scoped) ----

  getWebhookConfig(tenantId: string) {
    return this.webhook.getConfig(tenantId);
  }

  configureWebhook(tenantId: string, url: string, secret: string, userId?: string) {
    return this.webhook.configure(tenantId, url, secret).then(async () => {
      await this.audit(tenantId, "integration.connect", "Integration", "WEBHOOK", { provider: "WEBHOOK" }, userId);
      return { status: "configured" as const };
    });
  }

  postWebhookEvent(tenantId: string, event: string, payload: unknown) {
    return this.webhook.postEvent(tenantId, event, payload).then(() => ({ status: "sent" as const }));
  }

  /**
   * Public incoming webhook: the signature IS the authentication — find
   * the tenant whose secret verifies it, then create/update the ticket.
   * Returns null when no secret matches (caller answers 401).
   */
  async handleIncomingWebhook(payload: IncomingTicketPayload, signature: string | undefined) {
    const tenantId = await this.webhook.findTenantForSignature(payload, signature);
    if (!tenantId) return null;
    const ticket = await this.webhook.applyIncomingTicket(tenantId, payload);
    return { tenantId, ticket };
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
