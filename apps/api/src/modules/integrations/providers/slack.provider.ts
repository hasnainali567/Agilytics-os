import { Injectable, Logger } from "@nestjs/common";
import { WebClient } from "@slack/web-api";
import type { IntegrationProvider, ProviderKind } from "./provider.interface";
import {
  formatTicketAlertMessage,
  formatTicketClosedMessage,
  formatTicketLinkedMessage,
  formatTicketStartedMessage,
  type SlackCommitRef,
  type SlackTicketRef,
} from "./slack.message";

/**
 * Slack provider — Tier 1, thin slice (Phase 1).
 * Working: message formatting (slack.message.ts) + posting to a channel
 * once a bot token is configured. Skeleton / TODO: live OAuth flow
 * (exchange code → tokens, encrypt with KMS, store per workspace),
 * signing-secret verification on webhooks, Bolt app for slash commands.
 *
 * Configuration is env-var placeholders only — no token in code, no token
 * in logs:
 * - SLACK_BOT_TOKEN — bot token for the workspace (TODO: replace with the
 *   per-workspace KMS-encrypted token from the Integration row).
 * - SLACK_DEFAULT_CHANNEL — channel automation posts go to when a rule
 *   does not name one, e.g. "#agilytics".
 * - SLACK_SIGNING_SECRET — TODO: verify incoming webhook signatures.
 */
@Injectable()
export class SlackProvider implements IntegrationProvider {
  readonly provider: ProviderKind = "SLACK";
  private readonly logger = new Logger(SlackProvider.name);
  private readonly client: WebClient;

  constructor() {
    // No token yet → unauthenticated client; postMessage refuses to call
    // Slack until SLACK_BOT_TOKEN is set (see isConfigured / postMessage).
    this.client = new WebClient(process.env.SLACK_BOT_TOKEN);
  }

  /** True once a bot token is configured (env placeholder for Phase 1). */
  isConfigured(): boolean {
    return Boolean(process.env.SLACK_BOT_TOKEN);
  }

  /** Default channel for automation posts, or null when not configured. */
  defaultChannel(): string | null {
    return process.env.SLACK_DEFAULT_CHANNEL ?? null;
  }

  async connect(tenantId: string, code: string): Promise<void> {
    this.logger.log(
      `Slack connect requested for tenant ${tenantId} (TODO: OAuth, code length ${code.length})`,
    );
    void this.client;
  }

  async disconnect(tenantId: string): Promise<void> {
    this.logger.log(`Slack disconnect for tenant ${tenantId}`);
  }

  async sync(tenantId: string): Promise<void> {
    this.logger.log(`Slack sync for tenant ${tenantId} (TODO: channel list)`);
  }

  async handleWebhook(tenantId: string, payload: unknown): Promise<void> {
    // TODO: verify the Slack signing secret (SLACK_SIGNING_SECRET) before
    // acting on any payload; handle url_verification challenges here.
    this.logger.log(
      `Slack webhook for tenant ${tenantId}: ${JSON.stringify(payload).slice(0, 200)}`,
    );
  }

  /**
   * Post a message to a channel. Throws a plain error (never a Slack auth
   * failure) while no token is configured, so callers can skip gracefully.
   */
  async postMessage(channel: string, text: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error(
        "Slack is not configured: set SLACK_BOT_TOKEN (Phase 1 placeholder; " +
          "live OAuth stores a per-workspace KMS-encrypted token instead).",
      );
    }
    await this.client.chat.postMessage({ channel, text });
  }

  /** Commit closes ticket → Slack (automation: commit → ticket → Slack). */
  async postTicketClosed(
    channel: string,
    ticket: SlackTicketRef,
    commit: SlackCommitRef,
  ): Promise<void> {
    await this.postMessage(channel, formatTicketClosedMessage(ticket, commit));
  }

  /** Commit starts work on a ticket → Slack. */
  async postTicketStarted(
    channel: string,
    ticket: SlackTicketRef,
    commit: SlackCommitRef,
  ): Promise<void> {
    await this.postMessage(channel, formatTicketStartedMessage(ticket, commit));
  }

  /** Commit/PR mentions a ticket without moving it → Slack. */
  async postTicketLinked(
    channel: string,
    ticket: SlackTicketRef,
    commit: SlackCommitRef,
  ): Promise<void> {
    await this.postMessage(channel, formatTicketLinkedMessage(ticket, commit));
  }

  /** Ticket created / overdue / at-risk channel alert (trigger → action). */
  async postTicketAlert(
    channel: string,
    kind: "created" | "overdue" | "at-risk",
    ticket: SlackTicketRef,
    detail?: string,
  ): Promise<void> {
    await this.postMessage(channel, formatTicketAlertMessage(kind, ticket, detail));
  }
}
