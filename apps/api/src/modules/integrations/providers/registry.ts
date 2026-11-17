import { Injectable } from "@nestjs/common";
import { GitHubProvider } from "./github.provider";
import type { IntegrationProvider, ProviderKind } from "./provider.interface";
import { SlackProvider } from "./slack.provider";

/**
 * Provider registry — adding a provider means adding one file + one entry
 * here. Nothing else changes (controller, queue, web app).
 * Notion + Google skeletons are next; their SDKs are already pinned.
 */
@Injectable()
export class ProviderRegistry {
  private readonly providers: Record<string, IntegrationProvider>;

  constructor(slack: SlackProvider, github: GitHubProvider) {
    this.providers = {
      SLACK: slack,
      GITHUB: github,
    };
  }

  get(provider: ProviderKind): IntegrationProvider | undefined {
    return this.providers[provider];
  }

  list(): ProviderKind[] {
    return Object.keys(this.providers) as ProviderKind[];
  }
}
