import { Body, Controller, Get, Headers, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantId } from "../../common/decorators/tenant.decorator";
import { GitHubWebhookService } from "./github-webhook.service";
import { IntegrationsService } from "./integrations.service";
import { GitHubProvider } from "./providers/github.provider";
import type { ProviderKind } from "./providers/provider.interface";
import { ProviderRegistry } from "./providers/registry";

/**
 * Integrations / automations — Connections hub.
 * Lists connected providers for the workspace. OAuth tokens are stored
 * encrypted with KMS (see SECURITY.md) and are never returned here.
 * Connect/disconnect/import are written to AuditLog. Full catalog:
 * docs/INTEGRATIONS.md. Thin Slack + GitHub + Jira/ClickUp import are
 * the Phase 1 slice (SYSTEM-DESIGN.md / decision sheet Q14).
 */
@ApiTags("integrations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("integrations")
export class IntegrationsController {
  constructor(
    private readonly integrations: IntegrationsService,
    private readonly registry: ProviderRegistry,
    private readonly github: GitHubProvider,
    private readonly githubWebhook: GitHubWebhookService,
  ) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.integrations.list(tenantId);
  }

  @Post(":provider/connect")
  connect(@TenantId() tenantId: string, @Body() body: { provider: ProviderKind; code: string }) {
    return this.integrations.connect(tenantId, body.provider, body.code);
  }

  @Post(":provider/disconnect")
  disconnect(@TenantId() tenantId: string, @Body() body: { provider: ProviderKind }) {
    return this.integrations.disconnect(tenantId, body.provider);
  }

  /** Thin Slack: post a message to a configured channel. */
  @Post("slack/post")
  postToSlack(@Body() body: { channel: string; text: string }) {
    return this.integrations.postToSlack(body.channel, body.text);
  }

  /** Thin GitHub: open PRs for a repo (ticket view filters by ticket key). */
  @Get("github/pull-requests")
  listPullRequests(
    @Query("owner") owner: string,
    @Query("repo") repo: string,
    @Query("ticketKey") ticketKey?: string,
  ) {
    if (!owner || !repo) return { error: "owner and repo are required" };
    if (ticketKey) return this.github.listPullRequestsForTicket(owner, repo, ticketKey);
    return this.github.listPullRequests(owner, repo);
  }

  @Post(":provider/webhook")
  webhook(
    @TenantId() tenantId: string,
    @Body() body: { provider: ProviderKind; event?: string; payload: unknown },
    @Headers("x-github-event") githubEvent: string | undefined,
    @Headers("x-hub-signature-256") signature: string | undefined,
  ) {
    if (body.provider === "GITHUB") {
      // TODO: pass the RAW body so the signature can be verified —
      // Nest's JSON parser drops it (see GitHubWebhookService header).
      return this.githubWebhook
        .handle(
          tenantId,
          body.event ?? githubEvent ?? "unknown",
          (body.payload ?? {}) as Record<string, unknown>,
          { signature },
        )
        .then((r) => ({ status: "received", ...r }));
    }
    const provider = this.registry.get(body.provider);
    if (!provider) return { status: "not_available" as const, provider: body.provider };
    // TODO: verify the provider's webhook signature before dispatching.
    return provider
      .handleWebhook(tenantId, body.payload)
      .then(() => ({ status: "received" as const }));
  }
}
