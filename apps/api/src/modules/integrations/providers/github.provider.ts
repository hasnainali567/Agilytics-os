import { createHmac, timingSafeEqual } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { Octokit } from "@octokit/rest";
import { IntegrationCredentialStore } from "../credential-store.service";
import { buildOAuthState, getOAuthStateSecret, providerCallbackUrl } from "../oauth-state";
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
 * GitHub provider — Tier 1 (Phase 2: live OAuth).
 *
 * Flow: GET /integrations/GITHUB/authorize (authed) returns the GitHub
 * authorise URL with a signed state → user approves → GitHub redirects
 * to GET /integrations/GITHUB/callback?code&state (public, state
 * verified) → code exchanged at github.com/login/oauth/access_token →
 * token encrypted (TokenVault, AES placeholder until KMS) and stored
 * per workspace in the Integration row.
 *
 * Env (all optional — blank = provider disabled, authorize returns 503):
 * - GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET — GitHub OAuth app credentials.
 * - GITHUB_TOKEN — legacy Phase 1 fallback for public repos (used only
 *   when the workspace has no stored OAuth token).
 * - GITHUB_WEBHOOK_SECRET — shared secret for webhook signatures.
 */
@Injectable()
export class GitHubProvider implements IntegrationProvider {
  readonly provider: ProviderKind = "GITHUB";
  private readonly logger = new Logger(GitHubProvider.name);

  constructor(private readonly credentials: IntegrationCredentialStore) {}

  isOAuthConfigured(): boolean {
    return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
  }

  authorizeUrl(tenantId: string): string | null {
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId || !process.env.GITHUB_CLIENT_SECRET) return null;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: providerCallbackUrl("GITHUB"),
      scope: "repo read:user",
      state: buildOAuthState(tenantId, getOAuthStateSecret()),
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  /** Exchange the OAuth code for an access token and store it encrypted. */
  async connect(tenantId: string, code: string): Promise<void> {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error(
        "GitHub is not configured: set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET (see docs/INTEGRATIONS.md).",
      );
    }
    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: providerCallbackUrl("GITHUB"),
      }),
    });
    if (!res.ok) throw new Error(`GitHub OAuth exchange failed: HTTP ${res.status}`);
    const data = (await res.json()) as {
      access_token?: string;
      token_type?: string;
      scope?: string;
      error?: string;
      error_description?: string;
    };
    if (!data.access_token) {
      throw new Error(
        `GitHub OAuth exchange failed: ${data.error_description ?? data.error ?? "no access token returned"}`,
      );
    }
    await this.credentials.save(tenantId, "GITHUB", {
      access_token: data.access_token,
      token_type: data.token_type ?? "bearer",
      scope: data.scope ?? "",
    });
    this.logger.log(`GitHub connected for tenant ${tenantId}`);
  }

  async disconnect(tenantId: string): Promise<void> {
    await this.credentials.clear(tenantId, "GITHUB");
    this.logger.log(`GitHub disconnected for tenant ${tenantId}`);
  }

  async sync(tenantId: string): Promise<void> {
    const octokit = await this.clientForTenant(tenantId);
    if (!octokit) {
      this.logger.log(`GitHub sync skipped for tenant ${tenantId}: not connected`);
      return;
    }
    const { data } = await octokit.repos.listForAuthenticatedUser({ per_page: 1 });
    this.logger.log(
      `GitHub sync for tenant ${tenantId}: token valid, ${data.length > 0 ? "repos visible" : "no repos visible"}`,
    );
  }

  async handleWebhook(tenantId: string, payload: unknown): Promise<void> {
    // Real dispatch lives in GitHubWebhookService (signature check +
    // commit/PR → CommitRuleService). This keeps the registry interface.
    this.logger.log(
      `GitHub webhook for tenant ${tenantId}: ${JSON.stringify(payload).slice(0, 200)}`,
    );
  }

  /**
   * True when GITHUB_WEBHOOK_SECRET is set — i.e. webhook signatures
   * can (and must) be verified. When false, GitHubWebhookService
   * accepts payloads unverified with a loud warning (dev only).
   */
  isWebhookSecretConfigured(): boolean {
    return Boolean(process.env.GITHUB_WEBHOOK_SECRET);
  }

  /**
   * Verify a GitHub webhook signature (`X-Hub-Signature-256:
   * sha256=<hmac>`). Returns false — and logs, without the secret — when
   * GITHUB_WEBHOOK_SECRET is not configured, so an unverified payload is
   * never silently trusted. Callers must pass the RAW request body
   * (`req.rawBody`, enabled by `rawBody: true` in main.ts); Nest's JSON
   * parser drops it, so a re-serialised body would fail verification.
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

  /**
   * Octokit for a workspace: stored per-workspace OAuth token first, env
   * GITHUB_TOKEN as the Phase 1 fallback, unauthenticated (public repos
   * only) when neither exists.
   */
  async clientForTenant(tenantId?: string): Promise<Octokit | null> {
    if (tenantId) {
      const stored = await this.credentials.load(tenantId, "GITHUB");
      const token = stored?.access_token;
      if (typeof token === "string" && token.length > 0) return new Octokit({ auth: token });
    }
    if (process.env.GITHUB_TOKEN) return new Octokit({ auth: process.env.GITHUB_TOKEN });
    // No token at all: unauthenticated client (public repos, strict rate limit).
    return new Octokit();
  }

  /** List open PRs for a repo — used inside the ticket view. */
  async listPullRequests(
    owner: string,
    repo: string,
    tenantId?: string,
  ): Promise<LinkedPullRequest[]> {
    const octokit = await this.clientForTenant(tenantId);
    if (!octokit) throw new Error("GitHub is not connected for this workspace.");
    const { data } = await octokit.pulls.list({ owner, repo, state: "open" });
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
  async listPullRequestsForTicket(
    owner: string,
    repo: string,
    ticketKey: string,
    tenantId?: string,
  ) {
    const prs = await this.listPullRequests(owner, repo, tenantId);
    return prs.filter(
      (pr) =>
        pr.title.includes(ticketKey) ||
        (pr.body ?? "").includes(ticketKey) ||
        pr.headRef.includes(ticketKey),
    );
  }
}
