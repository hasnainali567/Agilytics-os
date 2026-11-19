import { describe, expect, it, jest, beforeEach, afterEach } from "@jest/globals";
import { createHmac } from "node:crypto";
import { UnauthorizedException } from "@nestjs/common";
import { GitHubWebhookService } from "./github-webhook.service";
import { GitHubProvider } from "./providers/github.provider";

// @octokit/rest is ESM-only and Jest (CJS ts-jest) cannot require it —
// it is pulled in transitively via GitHubProvider. Mock it (same as
// automation.service.spec.ts); signature verification uses node:crypto,
// not Octokit, so the mock changes nothing under test.
jest.mock("@octokit/rest", () => ({
  Octokit: class {
    constructor(..._args: unknown[]) {
      void _args;
    }
  },
}));

const SECRET = "test-github-webhook-secret";

function signGithub(rawBody: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
}

describe("GitHubWebhookService — signature verification", () => {
  let service: GitHubWebhookService;
  let applyCommit: ReturnType<typeof jest.fn>;
  let originalSecret: string | undefined;

  beforeEach(() => {
    originalSecret = process.env.GITHUB_WEBHOOK_SECRET;
    applyCommit = jest.fn(() => Promise.resolve([]));
    const github = new GitHubProvider({ load: async () => null } as never);
    const commitRule = { applyCommit, applyPullRequestMerged: jest.fn() } as never;
    service = new GitHubWebhookService(github, commitRule);
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.GITHUB_WEBHOOK_SECRET;
    else process.env.GITHUB_WEBHOOK_SECRET = originalSecret;
  });

  const pushPayload = { commits: [{ id: "abc123", message: "Fixes ENG-123: redirect" }] };

  it("accepts a push with a valid signature when the secret is configured", async () => {
    process.env.GITHUB_WEBHOOK_SECRET = SECRET;
    const rawBody = JSON.stringify(pushPayload);
    const result = await service.handle("tenant-1", "push", pushPayload, {
      rawBody,
      signature: signGithub(rawBody, SECRET),
    });
    expect(result.handled).toBe(true);
    expect(applyCommit).toHaveBeenCalledTimes(1);
  });

  it("rejects a tampered body with 401 when the secret is configured", async () => {
    process.env.GITHUB_WEBHOOK_SECRET = SECRET;
    const rawBody = JSON.stringify(pushPayload);
    const tampered = JSON.stringify({
      commits: [{ id: "abc123", message: "Fixes ENG-999: redirect" }],
    });
    await expect(
      service.handle("tenant-1", "push", pushPayload, {
        rawBody: tampered,
        signature: signGithub(rawBody, SECRET),
      }),
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      service.handle("tenant-1", "push", pushPayload, {
        rawBody: tampered,
        signature: signGithub(rawBody, SECRET),
      }),
    ).rejects.toThrow("Invalid GitHub webhook signature");
    expect(applyCommit).not.toHaveBeenCalled();
  });

  it("rejects a missing signature with 401 when the secret is configured", async () => {
    process.env.GITHUB_WEBHOOK_SECRET = SECRET;
    const rawBody = JSON.stringify(pushPayload);
    await expect(
      service.handle("tenant-1", "push", pushPayload, { rawBody }),
    ).rejects.toThrow("Invalid GitHub webhook signature");
    expect(applyCommit).not.toHaveBeenCalled();
  });

  it("rejects a wrong-secret signature with 401", async () => {
    process.env.GITHUB_WEBHOOK_SECRET = SECRET;
    const rawBody = JSON.stringify(pushPayload);
    await expect(
      service.handle("tenant-1", "push", pushPayload, {
        rawBody,
        signature: signGithub(rawBody, "a-different-secret"),
      }),
    ).rejects.toThrow("Invalid GitHub webhook signature");
  });

  it("accepts WITHOUT verification when no secret is configured (documented dev-only behaviour)", async () => {
    delete process.env.GITHUB_WEBHOOK_SECRET;
    const result = await service.handle("tenant-1", "push", pushPayload);
    expect(result.handled).toBe(true);
    expect(applyCommit).toHaveBeenCalledTimes(1);
  });
});
