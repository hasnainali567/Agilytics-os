import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantId } from "../../common/decorators/tenant.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { GitHubWebhookService } from "./github-webhook.service";
import { IntegrationsService } from "./integrations.service";
import type { ProviderKind } from "./providers/provider.interface";
import { ProviderRegistry } from "./providers/registry";
import type { IncomingTicketPayload } from "./providers/webhook.provider";

/**
 * Integrations / automations — Connections hub.
 * Lists connected providers for the workspace. OAuth tokens are stored
 * encrypted (TokenVault AES placeholder until KMS — see
 * docs/INTEGRATIONS.md) and are never returned here. Connect /
 * disconnect / import are written to AuditLog. Full catalog:
 * docs/INTEGRATIONS.md. Phase 2: live OAuth for Slack, GitHub, Notion
 * and Google, plus the generic webhook escape hatch.
 *
 * OAuth shape: GET /integrations/:provider/authorize (authed, returns
 * the provider URL) → provider redirects the browser to
 * GET /integrations/:provider/callback (public — the signed `state`
 * is the authentication) → 302 to the web callback page.
 * The incoming generic webhook is likewise public — its HMAC signature
 * is the authentication.
 */
@ApiTags("integrations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("integrations")
export class IntegrationsController {
  constructor(
    private readonly integrations: IntegrationsService,
    private readonly registry: ProviderRegistry,
    private readonly githubWebhook: GitHubWebhookService,
  ) {}

  @ApiOperation({ summary: "List integrations" })
  @ApiResponse({ status: 200, description: "Success" })
  @Get()
  list(@TenantId() tenantId: string) {
    return this.integrations.list(tenantId);
  }

  /** Authorize URL for the OAuth flow (503 when the provider is not configured). */
  @ApiOperation({ summary: "Authorize" })
  @ApiResponse({ status: 200, description: "Success" })
  @Get(":provider/authorize")
  authorize(@TenantId() tenantId: string, @Param("provider") provider: ProviderKind) {
    return this.integrations.authorizeUrl(tenantId, provider);
  }

  /**
   * OAuth callback (public — the provider redirects the browser here,
   * no JWT is possible). Verifies the signed state, exchanges the code,
   * then redirects to the web callback page with the outcome.
   */
  @Public()
  @ApiOperation({ summary: "Oauth callback" })
  @ApiResponse({ status: 200, description: "Success" })
  @Get(":provider/callback")
  async oauthCallback(
    @Param("provider") provider: ProviderKind,
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Res() res: Response,
  ) {
    const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5173";
    const redirect = (status: "success" | "error", message?: string) => {
      const qs = new URLSearchParams({ provider, status, ...(message ? { message } : {}) });
      res.redirect(`${webOrigin}/connections/callback?${qs.toString()}`);
    };
    if (error) return redirect("error", `Provider refused: ${error}`);
    if (!code || !state) return redirect("error", "Missing code or state in callback");
    try {
      await this.integrations.handleOAuthCallback(provider, code, state);
      return redirect("success");
    } catch (err) {
      return redirect("error", (err as Error).message.slice(0, 200));
    }
  }

  @ApiOperation({ summary: "Connect" })
  @ApiResponse({ status: 201, description: "Created" })
  @Post(":provider/connect")
  connect(@TenantId() tenantId: string, @Body() body: { provider: ProviderKind; code: string }) {
    return this.integrations.connect(tenantId, body.provider, body.code);
  }

  @ApiOperation({ summary: "Disconnect" })
  @ApiResponse({ status: 201, description: "Created" })
  @Post(":provider/disconnect")
  disconnect(@TenantId() tenantId: string, @Body() body: { provider: ProviderKind }) {
    return this.integrations.disconnect(tenantId, body.provider);
  }

  @ApiOperation({ summary: "Sync" })
  @ApiResponse({ status: 201, description: "Created" })
  @Post(":provider/sync")
  sync(@TenantId() tenantId: string, @Param("provider") provider: ProviderKind) {
    return this.integrations.syncProvider(tenantId, provider);
  }

  /** Thin Slack: post a message to a configured channel (workspace token first). */
  @ApiOperation({ summary: "Post to slack" })
  @ApiResponse({ status: 201, description: "Created" })
  @Post("slack/post")
  postToSlack(@TenantId() tenantId: string, @Body() body: { channel: string; text: string }) {
    return this.integrations.postToSlack(body.channel, body.text, tenantId);
  }

  /** Thin GitHub: open PRs for a repo (ticket view filters by ticket key). */
  @ApiOperation({ summary: "List pull requests" })
  @ApiResponse({ status: 200, description: "Success" })
  @Get("github/pull-requests")
  listPullRequests(
    @TenantId() tenantId: string,
    @Query("owner") owner: string,
    @Query("repo") repo: string,
    @Query("ticketKey") ticketKey?: string,
  ) {
    if (!owner || !repo) return { error: "owner and repo are required" };
    return this.integrations.listPullRequests(owner, repo, ticketKey, tenantId);
  }

  // ---- Notion ----

  /** Pages/databases the connected Notion integration can see. */
  @ApiOperation({ summary: "List notion items" })
  @ApiResponse({ status: 200, description: "Success" })
  @Get("notion/databases")
  listNotionItems(@TenantId() tenantId: string) {
    return this.integrations.listNotionItems(tenantId);
  }

  /** Stored Notion link records (from the last sync / pinned links). */
  @ApiOperation({ summary: "List notion links" })
  @ApiResponse({ status: 200, description: "Success" })
  @Get("notion/links")
  listNotionLinks(@TenantId() tenantId: string) {
    return this.integrations.listNotionLinks(tenantId);
  }

  /** Pin a Notion page/database to a project. */
  @ApiOperation({ summary: "Link notion item" })
  @ApiResponse({ status: 201, description: "Created" })
  @Post("notion/databases/:id/link")
  linkNotionItem(
    @TenantId() tenantId: string,
    @Param("id") itemId: string,
    @Body() body: { projectId: string },
  ) {
    return this.integrations.linkNotionItem(tenantId, itemId, body.projectId);
  }

  // ---- Google: Calendar / Gmail / Drive ----

  @ApiOperation({ summary: "List google events" })
  @ApiResponse({ status: 200, description: "Success" })
  @Get("google/calendar/events")
  listGoogleEvents(@TenantId() tenantId: string, @Query("maxResults") maxResults?: string) {
    return this.integrations.listGoogleEvents(tenantId, Number(maxResults) || 10);
  }

  /** Create a calendar event from a sprint deadline. */
  @ApiOperation({ summary: "Create google event" })
  @ApiResponse({ status: 201, description: "Created" })
  @Post("google/calendar/events")
  createGoogleEvent(@TenantId() tenantId: string, @Body() body: { sprintId: string }) {
    return this.integrations.createGoogleEventFromSprint(tenantId, body.sprintId);
  }

  @ApiOperation({ summary: "List gmail messages" })
  @ApiResponse({ status: 200, description: "Success" })
  @Get("google/gmail/messages")
  listGmailMessages(@TenantId() tenantId: string, @Query("maxResults") maxResults?: string) {
    return this.integrations.listGmailMessages(tenantId, Number(maxResults) || 10);
  }

  /** Create a ticket from an email (subject → title). */
  @ApiOperation({ summary: "Create ticket from email" })
  @ApiResponse({ status: 201, description: "Created" })
  @Post("google/gmail/messages/:id/create-ticket")
  createTicketFromEmail(
    @TenantId() tenantId: string,
    @Param("id") messageId: string,
    @Body() body: { projectId: string },
  ) {
    return this.integrations.createTicketFromEmail(tenantId, messageId, body.projectId);
  }

  @ApiOperation({ summary: "List drive files" })
  @ApiResponse({ status: 200, description: "Success" })
  @Get("google/drive/files")
  listDriveFiles(@TenantId() tenantId: string, @Query("maxResults") maxResults?: string) {
    return this.integrations.listDriveFiles(tenantId, Number(maxResults) || 10);
  }

  /** Attach a Drive file link to a ticket (stored as a linked Document). */
  @ApiOperation({ summary: "Attach drive file" })
  @ApiResponse({ status: 201, description: "Created" })
  @Post("google/drive/files/:id/attach")
  attachDriveFile(
    @TenantId() tenantId: string,
    @Param("id") fileId: string,
    @Body() body: { ticketId: string },
  ) {
    return this.integrations.attachDriveFile(tenantId, body.ticketId, fileId);
  }

  // ---- Generic webhook (escape hatch) ----

  /** Outgoing webhook config for this workspace (URL only — the secret is never returned). */
  @ApiOperation({ summary: "Get webhook config" })
  @ApiResponse({ status: 200, description: "Success" })
  @Get("webhook/config")
  getWebhookConfig(@TenantId() tenantId: string) {
    return this.integrations.getWebhookConfig(tenantId);
  }

  /** Set the outgoing webhook URL + shared secret (stored encrypted). */
  @ApiOperation({ summary: "Configure webhook" })
  @ApiResponse({ status: 201, description: "Created" })
  @Post("webhook/config")
  configureWebhook(
    @TenantId() tenantId: string,
    @Body() body: { url: string; secret: string },
  ) {
    return this.integrations.configureWebhook(tenantId, body.url, body.secret);
  }

  /** Fire a test event at the configured outgoing webhook. */
  @ApiOperation({ summary: "Test webhook" })
  @ApiResponse({ status: 201, description: "Created" })
  @Post("webhook/test")
  testWebhook(@TenantId() tenantId: string, @Body() body: { event?: string }) {
    return this.integrations.postWebhookEvent(
      tenantId,
      body.event ?? "test",
      { message: "Agilytics webhook test", at: new Date().toISOString() },
    );
  }

  /**
   * Incoming generic webhook (public — the HMAC signature in
   * X-Agilytics-Signature is the authentication; the secret routes the
   * payload to its workspace). Creates/updates a ticket.
   */
  @Public()
  @ApiOperation({ summary: "Incoming webhook" })
  @ApiResponse({ status: 201, description: "Created" })
  @Post("webhook/incoming")
  async incomingWebhook(
    @Body() body: IncomingTicketPayload,
    @Headers("x-agilytics-signature") signature: string | undefined,
  ) {
    const result = await this.integrations.handleIncomingWebhook(body, signature);
    if (!result) throw new UnauthorizedException("Invalid webhook signature");
    return { status: "received" as const, ticket: result.ticket };
  }

  /**
   * Provider webhook entry point. The raw request body (`req.rawBody`,
   * enabled by `rawBody: true` in main.ts) is passed through so each
   * provider can verify its signature over the exact bytes the sender
   * signed — GitHub via GitHubWebhookService (401 on a bad signature
   * when GITHUB_WEBHOOK_SECRET is set), Slack via the provider's
   * handleWebhook (same for SLACK_SIGNING_SECRET). When no secret is
   * configured the payload is accepted with a warning (dev only).
   *
   * NOTE: this route is still an authenticated forwarder (JWT +
   * tenant) — a real provider cannot call it directly. A public
   * provider webhook endpoint (tenant resolved from the payload /
   * repo) is a follow-up; the signature verification itself is done.
   */
  @ApiOperation({ summary: "Webhook" })
  @ApiResponse({ status: 201, description: "Created" })
  @Post(":provider/webhook")
  webhook(
    @TenantId() tenantId: string,
    @Body() body: { provider: ProviderKind; event?: string; payload: unknown },
    @Headers("x-github-event") githubEvent: string | undefined,
    @Headers("x-hub-signature-256") signature: string | undefined,
    @Headers("x-slack-signature") slackSignature: string | undefined,
    @Headers("x-slack-request-timestamp") slackTimestamp: string | undefined,
    @Req() req: Request,
  ) {
    const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
    if (body.provider === "GITHUB") {
      return this.githubWebhook
        .handle(
          tenantId,
          body.event ?? githubEvent ?? "unknown",
          (body.payload ?? {}) as Record<string, unknown>,
          { signature, rawBody },
        )
        .then((r) => ({ status: "received", ...r }));
    }
    const provider = this.registry.get(body.provider);
    if (!provider) return { status: "not_available" as const, provider: body.provider };
    return provider
      .handleWebhook(tenantId, body.payload, {
        rawBody,
        timestamp: slackTimestamp,
        signature: slackSignature,
      })
      .then(() => ({ status: "received" as const }));
  }
}
