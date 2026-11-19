import { Injectable } from "@nestjs/common";
import { GitHubProvider } from "./github.provider";
import { GoogleProvider } from "./google.provider";
import { NotionProvider } from "./notion.provider";
import type { IntegrationProvider, ProviderKind } from "./provider.interface";
import { SlackProvider } from "./slack.provider";
import { WebhookProvider } from "./webhook.provider";

/**
 * Provider registry — adding a provider means adding one file + one entry
 * here. Nothing else changes (controller, queue, web app).
 * Phase 2: Slack, GitHub (live OAuth), Notion, Google (Calendar + Gmail
 * + Drive, stored as GOOGLE_CALENDAR), generic Webhook. ZAPIER has no
 * native provider — Zapier/Make consume the generic webhook.
 */
@Injectable()
export class ProviderRegistry {
  private readonly providers: Record<string, IntegrationProvider>;

  constructor(
    slack: SlackProvider,
    github: GitHubProvider,
    notion: NotionProvider,
    google: GoogleProvider,
    webhook: WebhookProvider,
  ) {
    this.providers = {
      SLACK: slack,
      GITHUB: github,
      NOTION: notion,
      GOOGLE_CALENDAR: google,
      GOOGLE: google, // alias — stored as GOOGLE_CALENDAR (Prisma enum)
      WEBHOOK: webhook,
    };
  }

  get(provider: ProviderKind): IntegrationProvider | undefined {
    return this.providers[provider];
  }

  list(): ProviderKind[] {
    return Object.keys(this.providers) as ProviderKind[];
  }
}
