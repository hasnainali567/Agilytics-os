import { Injectable, Logger } from "@nestjs/common";
import { WebClient } from "@slack/web-api";
import type { IntegrationProvider, ProviderKind } from "./provider.interface";

/**
 * Slack provider — Tier 1.
 * Channel alerts, create task from message, daily digest, slash commands.
 * TODO: live OAuth flow (exchange code → tokens, encrypt with KMS, store
 * per workspace), signing-secret verification, Bolt app for slash commands.
 */
@Injectable()
export class SlackProvider implements IntegrationProvider {
  readonly provider: ProviderKind = "SLACK";
  private readonly logger = new Logger(SlackProvider.name);
  private readonly client = new WebClient();

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
    this.logger.log(
      `Slack webhook for tenant ${tenantId}: ${JSON.stringify(payload).slice(0, 200)}`,
    );
  }

  /** Post a message to a channel — used by automation rules (trigger → action). */
  async postMessage(channel: string, text: string): Promise<void> {
    await this.client.chat.postMessage({ channel, text });
  }
}
