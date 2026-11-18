import { createHmac, timingSafeEqual } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { Octokit } from "@octokit/rest";
import type { IntegrationProvider, ProviderKind } from "./provider.interface";

/** A PR as shown inside the ticket view (Phase 1: list, filtered by key). */
export interface LinkedPullRequest {
  id: number;
  number: number;
  title: string;
  url: string;
  state: string;
  headRef: string;
  body: string | null;
}

/**
 * GitHub provider — Tier 1, thin slice (Phase 1).
 * Working: PR listing (+ filter by ticket key for the ticket view) and
 * HMAC-SHA256 webhook signature verification against the configured
 * secret. Skeleton / TODO: live GitHub App / OAuth flow, webhook-secret
 * provisioning, PR-merge handling lives in CommitRuleService via the
 * webhook service (this provider only parses + verifies).
 *
 * Env-var placeholders only — no token/secret in code or logs:
 * - GITHUB_TOKEN — TODO: per-workspace token for private repos (the
 *   unauthenticated client below only reads public repos).
 * - GITHUB_WEBHOOK_SECRET — shared secret for webhook signatures.
 */
@Injectable()
export class GitHubProvider implements IntegrationProvider {
  readonly provider: ProviderKind = "GITHUB";
  private readonly logger = new Logger(GitHubProvider.name);
  private readonly octokit = new Octokit(
    process.env.GITHUB_TOKEN ? { auth: process.env.GITHUB_TOKEN } : {},
  );

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
    // Real dispatch lives in GitHubWebhookService (signature check +
    // commit/PR → CommitRuleService). This keeps the registry interface.
    this.logger.log(
      `GitHub webhook for tenant ${tenantId}: ${JSON.stringify(payload).slice(0, 200)}`,
    );
  }

  /**
   * Verify a GitHub webhook signature (`X-Hub-Signature-256:
   * sha256=<hmac>`). Returns false — and logs, without the secret — when
   * GITHUB_WEBHOOK_SECRET is not configured, so an unverified payload is
   * never silently trusted. Callers must pass the RAW request body;
   * Nest's JSON parser drops it, so the controller marks verification
   * TODO until raw-body capture lands (see GitHubWebhookService).
   */
  verifyWebhookSignature(rawBody: string | Buffer, signatureHeader: string | undefined): boolean {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) {
      this.logger.warn("GITHUB_WEBHOOK_SECRET is not configured — cannot verify GitHub webhook");
      return false;
    }
    if (!signatureHeader?.startsWith("sha256=")) return false;
    const expected = Buffer.from(
      `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`,
      "utf8",
    );
    const actual = Buffer.from(signatureHeader, "utf8");
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  /** List open PRs for a repo — used inside the ticket view. */
  async listPullRequests(owner: string, repo: string): Promise<LinkedPullRequest[]> {
    const { data } = await this.octokit.pulls.list({ owner, repo, state: "open" });
    return data.map((pr) => ({
      id: pr.id,
      number: pr.number,
      title: pr.title,
      url: pr.html_url,
      state: pr.state,
      headRef: pr.head.ref,
      body: pr.body ?? null,
    }));
  }

  /**
   * PRs in a repo that reference a ticket key — in the title, body or
   * branch name. This is the list the ticket view shows for that ticket.
   */
  async listPullRequestsForTicket(owner: string, repo: string, ticketKey: string) {
    const prs = await this.listPullRequests(owner, repo);
    return prs.filter(
      (pr) =>
        pr.title.includes(ticketKey) ||
        (pr.body ?? "").includes(ticketKey) ||
        pr.headRef.includes(ticketKey),
    );
  }
}
