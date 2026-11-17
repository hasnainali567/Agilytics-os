import { Injectable, Logger } from "@nestjs/common";
import { Octokit } from "@octokit/rest";
import type { IntegrationProvider, ProviderKind } from "./provider.interface";

/**
 * GitHub provider — Tier 1.
 * Link PRs/commits to tickets, status moves on PR merge, PR list in ticket.
 * TODO: live OAuth App flow, webhook secret verification, PR-merge handler
 * that moves the linked ticket to DONE via TicketsService.
 */
@Injectable()
export class GitHubProvider implements IntegrationProvider {
  readonly provider: ProviderKind = "GITHUB";
  private readonly logger = new Logger(GitHubProvider.name);
  private readonly octokit = new Octokit();

  async connect(tenantId: string, code: string): Promise<void> {
    this.logger.log(
      `GitHub connect requested for tenant ${tenantId} (TODO: OAuth, code length ${code.length})`,
    );
    void this.octokit;
  }

  async disconnect(tenantId: string): Promise<void> {
    this.logger.log(`GitHub disconnect for tenant ${tenantId}`);
  }

  async sync(tenantId: string): Promise<void> {
    this.logger.log(`GitHub sync for tenant ${tenantId} (TODO: list PRs for linked repos)`);
  }

  async handleWebhook(tenantId: string, payload: unknown): Promise<void> {
    this.logger.log(
      `GitHub webhook for tenant ${tenantId}: ${JSON.stringify(payload).slice(0, 200)}`,
    );
  }

  /** List open PRs for a repo — used inside the ticket view. */
  async listPullRequests(owner: string, repo: string) {
    const { data } = await this.octokit.pulls.list({ owner, repo, state: "open" });
    return data.map((pr) => ({ id: pr.id, number: pr.number, title: pr.title, url: pr.html_url }));
  }
}
