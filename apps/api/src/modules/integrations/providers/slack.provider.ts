import { Injectable, Logger } from "@nestjs/common";
import { WebClient } from "@slack/web-api";
import { IntegrationCredentialStore } from "../credential-store.service";
import { buildOAuthState, getOAuthStateSecret, providerCallbackUrl } from "../oauth-state";
import type { IntegrationProvider, ProviderKind } from "./provider.interface";
import {
  formatTicketAlertMessage,
  formatTicketClosedMessage,
  formatTicketLinkedMessage,
  formatTicketStartedMessage,
  type SlackCommitRef,
  type SlackTicketRef,
} from "./slack.message";

const OAUTH_SCOPES = ["channels:read", "chat:write", "commands"].join(",");

/**
 * Slack provider — Tier 1 (Phase 2: live OAuth).
 *
 * Flow: GET /integrations/SLACK/authorize (authed) returns the Slack
 * authorise URL with a signed state → user approves in Slack → Slack
 * redirects to GET /integrations/SLACK/callback?code&state (public,
 * state verified) → code exchanged via oauth.v2.access → bot token
 * encrypted (TokenVault, AES placeholder until KMS) and stored per
 * workspace in the Integration row.
 *
 * Env (all optional — blank = provider disabled, authorize returns 503):
 * - SLACK_CLIENT_ID / SLACK_CLIENT_SECRET — Slack app OAuth credentials.
 * - SLACK_BOT_TOKEN — legacy Phase 1 fallback: used only when the
 *   workspace has no stored OAuth token.
 * - SLACK_DEFAULT_CHANNEL — channel automation posts go to, e.g. "#agilytics".
 * - SLACK_SIGNING_SECRET — TODO: verify incoming webhook signatures.
 */
@Injectable()
export class SlackProvider implements IntegrationProvider {
  readonly provider: ProviderKind = "SLACK";
  private readonly logger = new Logger(SlackProvider.name);

  constructor(private readonly credentials: IntegrationCredentialStore) {}

  /** True once OAuth credentials are configured (client id + secret). */
  isOAuthConfigured(): boolean {
    return Boolean(process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET);
  }

  /** Legacy Phase 1 check: an env bot token exists. */
  isConfigured(): boolean {
    return Boolean(process.env.SLACK_BOT_TOKEN);
  }

  /** Default channel for automation posts, or null when not configured. */
  defaultChannel(): string | null {
    return process.env.SLACK_DEFAULT_CHANNEL ?? null;
  }

  authorizeUrl(tenantId: string): string | null {
    const clientId = process.env.SLACK_CLIENT_ID;
    if (!clientId || !process.env.SLACK_CLIENT_SECRET) return null;
    const params = new URLSearchParams({
      client_id: clientId,
      scope: OAUTH_SCOPES,
      redirect_uri: providerCallbackUrl("SLACK"),
      state: buildOAuthState(tenantId, getOAuthStateSecret()),
    });
    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  /** Exchange the OAuth code for a bot token and store it encrypted. */
  async connect(tenantId: string, code: string): Promise<void> {
    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error(
        "Slack is not configured: set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET (see docs/INTEGRATIONS.md).",
      );
    }
    const client = new WebClient();
    const result = await client.oauth.v2.access({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: providerCallbackUrl("SLACK"),
    });
    if (!result.ok || !result.access_token) {
      throw new Error("Slack OAuth exchange failed: no access token returned.");
    }
    await this.credentials.save(tenantId, "SLACK", {
      access_token: result.access_token,
      token_type: result.token_type ?? "bot",
      scope: result.scope ?? OAUTH_SCOPES,
      bot_user_id: result.bot_user_id ?? null,
      team_id: (result.team as { id?: string } | undefined)?.id ?? null,
      team_name: (result.team as { name?: string } | undefined)?.name ?? null,
    });
    this.logger.log(`Slack connected for tenant ${tenantId}`);
  }

  async disconnect(tenantId: string): Promise<void> {
    await this.credentials.clear(tenantId, "SLACK");
    this.logger.log(`Slack disconnected for tenant ${tenantId}`);
  }

  async sync(tenantId: string): Promise<void> {
    // Lists the channels the bot can see — proves the stored token works.
    const client = await this.clientForTenant(tenantId);
    if (!client) {
      this.logger.log(`Slack sync skipped for tenant ${tenantId}: not connected`);
      return;
    }
    const { channels } = await client.conversations.list({ limit: 100 });
    this.logger.log(
      `Slack sync for tenant ${tenantId}: ${(channels ?? []).length} channels visible`,
    );
  }

  async handleWebhook(tenantId: string, payload: unknown): Promise<void> {
    // TODO: verify the Slack signing secret (SLACK_SIGNING_SECRET) before
    // acting on any payload; handle url_verification challenges here.
    this.logger.log(
      `Slack webhook for tenant ${tenantId}: ${JSON.stringify(payload).slice(0, 200)}`,
    );
  }

  /**
   * Resolve a Slack client for a workspace: stored per-workspace OAuth
   * token first, env SLACK_BOT_TOKEN as the Phase 1 fallback, null when
   * neither exists (callers turn that into a clear "not connected" error).
   */
  async clientForTenant(tenantId?: string): Promise<WebClient | null> {
    if (tenantId) {
      const stored = await this.credentials.load(tenantId, "SLACK");
      const token = stored?.access_token;
      if (typeof token === "string" && token.length > 0) return new WebClient(token);
    }
    return process.env.SLACK_BOT_TOKEN ? new WebClient(process.env.SLACK_BOT_TOKEN) : null;
  }

  /**
   * Post a message to a channel. Uses the workspace's stored OAuth token
   * when present, else the env bot token; throws a clear error when
   * neither exists.
   */
  async postMessage(channel: string, text: string, tenantId?: string): Promise<void> {
    const client = await this.clientForTenant(tenantId);
    if (!client) {
      throw new Error(
        "Slack is not connected for this workspace: connect Slack from the Connections page " +
          "(or set SLACK_BOT_TOKEN as the Phase 1 fallback).",
      );
    }
    await client.chat.postMessage({ channel, text });
  }

  /** Commit closes ticket → Slack (automation: commit → ticket → Slack). */
  async postTicketClosed(
    channel: string,
    ticket: SlackTicketRef,
    commit: SlackCommitRef,
    tenantId?: string,
  ): Promise<void> {
    await this.postMessage(channel, formatTicketClosedMessage(ticket, commit), tenantId);
  }

  /** Commit starts work on a ticket → Slack. */
  async postTicketStarted(
    channel: string,
    ticket: SlackTicketRef,
    commit: SlackCommitRef,
    tenantId?: string,
  ): Promise<void> {
    await this.postMessage(channel, formatTicketStartedMessage(ticket, commit), tenantId);
  }

  /** Commit/PR mentions a ticket without moving it → Slack. */
  async postTicketLinked(
    channel: string,
    ticket: SlackTicketRef,
    commit: SlackCommitRef,
    tenantId?: string,
  ): Promise<void> {
    await this.postMessage(channel, formatTicketLinkedMessage(ticket, commit), tenantId);
  }

  /** Ticket created / overdue / at-risk channel alert (trigger → action). */
  async postTicketAlert(
    channel: string,
    kind: "created" | "overdue" | "at-risk",
    ticket: SlackTicketRef,
    detail?: string,
    tenantId?: string,
  ): Promise<void> {
    await this.postMessage(channel, formatTicketAlertMessage(kind, ticket, detail), tenantId);
  }
}
