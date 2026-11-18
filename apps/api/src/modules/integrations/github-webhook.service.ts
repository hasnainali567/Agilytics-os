import { Injectable, Logger } from "@nestjs/common";
import { CommitRuleService, type CommitRuleOutcome } from "./commit-rule.service";
import { GitHubProvider } from "./providers/github.provider";

/**
 * GitHub webhook receiver (stub-grade Phase 1).
 *
 * Handles `push` (commits → ticket rule) and `pull_request` with
 * action `closed` + `merged: true` (merged PR → close linked tickets).
 * Unknown events are logged and ignored.
 *
 * Signature check — TODO, honestly incomplete: verification needs the RAW
 * request body, but Nest's JSON parser hands this service the parsed
 * payload, so `verifyWebhookSignature` cannot run yet. The HMAC check
 * itself is implemented in GitHubProvider.verifyWebhookSignature; the
 * remaining work is raw-body capture middleware in main.ts (another
 * slice — main.ts is outside this slice's ownership). Until then this
 * service logs a warning and proceeds, and the endpoint must stay behind
 * auth / a secret URL in any deployment. Do NOT treat a received webhook
 * as verified.
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
    if (opts?.rawBody && opts.signature) {
      if (!this.github.verifyWebhookSignature(opts.rawBody, opts.signature)) {
        this.logger.warn(`GitHub webhook signature verification failed for tenant ${tenantId}`);
        return { handled: false, outcomes: [] };
      }
    } else {
      // TODO: raw-body capture — signature NOT verified (see header).
      this.logger.warn(
        `GitHub webhook ${event} for tenant ${tenantId} accepted WITHOUT signature verification (TODO: raw-body capture)`,
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
