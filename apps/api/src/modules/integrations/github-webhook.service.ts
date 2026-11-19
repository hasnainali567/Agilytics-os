import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { CommitRuleService, type CommitRuleOutcome } from "./commit-rule.service";
import { GitHubProvider } from "./providers/github.provider";

/**
 * GitHub webhook receiver.
 *
 * Handles `push` (commits → ticket rule) and `pull_request` with
 * action `closed` + `merged: true` (merged PR → close linked tickets).
 * Unknown events are logged and ignored.
 *
 * Signature verification: the caller passes the RAW request body
 * (`req.rawBody`, enabled by `rawBody: true` in main.ts) plus the
 * `X-Hub-Signature-256` header, and the HMAC-SHA256 check runs against
 * GITHUB_WEBHOOK_SECRET. When the secret is configured, a missing or
 * bad signature is rejected with 401 — never processed. When no secret
 * is configured (local dev only), the payload is accepted with a loud
 * warning; set the secret before exposing this endpoint anywhere real.
 */
@Injectable()
export class GitHubWebhookService {
  private readonly logger = new Logger(GitHubWebhookService.name);

  constructor(
    private readonly github: GitHubProvider,
    private readonly commitRule: CommitRuleService,
  ) {}

  async handle(
    tenantId: string,
    event: string,
    payload: Record<string, unknown>,
    opts?: { rawBody?: string | Buffer; signature?: string },
  ): Promise<{ handled: boolean; outcomes: CommitRuleOutcome[] }> {
    if (this.github.isWebhookSecretConfigured()) {
      if (
        !opts?.rawBody ||
        !opts.signature ||
        !this.github.verifyWebhookSignature(opts.rawBody, opts.signature)
      ) {
        this.logger.warn(
          `GitHub webhook ${event} for tenant ${tenantId} REJECTED: missing or invalid signature`,
        );
        throw new UnauthorizedException("Invalid GitHub webhook signature");
      }
    } else {
      // No secret configured — dev-only behaviour: accept unverified
      // with a loud warning. Never do this in production.
      this.logger.warn(
        `GitHub webhook ${event} for tenant ${tenantId} accepted WITHOUT signature verification — set GITHUB_WEBHOOK_SECRET`,
      );
    }

    if (event === "push") {
      const commits =
        (payload.commits as
          | { id: string; message: string; author?: { email?: string; name?: string } }[]
          | undefined) ?? [];
      const outcomes: CommitRuleOutcome[] = [];
      for (const c of commits) {
        outcomes.push(
          ...(await this.commitRule.applyCommit(tenantId, {
            sha: c.id,
            message: c.message,
            authorEmail: c.author?.email,
            authorName: c.author?.name,
          })),
        );
      }
      return { handled: true, outcomes };
    }

    if (event === "pull_request") {
      const pr = payload.pull_request as
        | {
            number: number;
            title: string;
            body?: string | null;
            head: { ref: string };
            merged?: boolean;
          }
        | undefined;
      if (payload.action === "closed" && pr?.merged) {
        const outcomes = await this.commitRule.applyPullRequestMerged(tenantId, {
          number: pr.number,
          title: pr.title,
          body: pr.body,
          headRef: pr.head.ref,
        });
        return { handled: true, outcomes };
      }
      return { handled: true, outcomes: [] };
    }

    this.logger.log(`GitHub webhook event ${event} ignored (no handler)`);
    return { handled: false, outcomes: [] };
  }
}
