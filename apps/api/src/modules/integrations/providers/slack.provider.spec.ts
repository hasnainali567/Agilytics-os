import { describe, expect, it, beforeEach, afterEach } from "@jest/globals";
import { createHmac } from "node:crypto";
import { SlackProvider } from "./slack.provider";

const SECRET = "test-slack-signing-secret";

function signSlack(rawBody: string, timestamp: string, secret: string): string {
  const base = `v0:${timestamp}:${rawBody}`;
  return `v0=${createHmac("sha256", secret).update(base).digest("hex")}`;
}

describe("SlackProvider — signing-secret verification", () => {
  let provider: SlackProvider;
  let originalSecret: string | undefined;

  beforeEach(() => {
    originalSecret = process.env.SLACK_SIGNING_SECRET;
    provider = new SlackProvider({ load: async () => null, save: async () => undefined, clear: async () => undefined } as never);
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.SLACK_SIGNING_SECRET;
    else process.env.SLACK_SIGNING_SECRET = originalSecret;
  });

  it("accepts a payload with a valid v0 signature", async () => {
    process.env.SLACK_SIGNING_SECRET = SECRET;
    const rawBody = JSON.stringify({ type: "event_callback", event: { type: "message" } });
    const timestamp = String(Math.floor(Date.now() / 1000));
    await expect(
      provider.handleWebhook("tenant-1", JSON.parse(rawBody), {
        rawBody,
        timestamp,
        signature: signSlack(rawBody, timestamp, SECRET),
      }),
    ).resolves.toBeUndefined();
  });

  it("rejects a tampered body with 401 when the secret is configured", async () => {
    process.env.SLACK_SIGNING_SECRET = SECRET;
    const rawBody = JSON.stringify({ type: "event_callback" });
    const tampered = JSON.stringify({ type: "event_callback", event: { type: "forged" } });
    const timestamp = String(Math.floor(Date.now() / 1000));
    await expect(
      provider.handleWebhook("tenant-1", JSON.parse(tampered), {
        rawBody: tampered,
        timestamp,
        signature: signSlack(rawBody, timestamp, SECRET),
      }),
    ).rejects.toThrow("Invalid Slack webhook signature");
  });

  it("rejects a missing signature with 401 when the secret is configured", async () => {
    process.env.SLACK_SIGNING_SECRET = SECRET;
    const rawBody = JSON.stringify({ type: "event_callback" });
    const timestamp = String(Math.floor(Date.now() / 1000));
    await expect(
      provider.handleWebhook("tenant-1", JSON.parse(rawBody), { rawBody, timestamp }),
    ).rejects.toThrow("Invalid Slack webhook signature");
  });

  it("rejects a stale timestamp (replay protection, > 5 minutes)", async () => {
    process.env.SLACK_SIGNING_SECRET = SECRET;
    const rawBody = JSON.stringify({ type: "event_callback" });
    const timestamp = String(Math.floor(Date.now() / 1000) - 3600);
    await expect(
      provider.handleWebhook("tenant-1", JSON.parse(rawBody), {
        rawBody,
        timestamp,
        signature: signSlack(rawBody, timestamp, SECRET),
      }),
    ).rejects.toThrow("Invalid Slack webhook signature");
  });

  it("verifySlackSignature returns false without a configured secret", () => {
    delete process.env.SLACK_SIGNING_SECRET;
    const rawBody = "{}";
    const timestamp = String(Math.floor(Date.now() / 1000));
    expect(provider.verifySlackSignature(rawBody, timestamp, signSlack(rawBody, timestamp, SECRET))).toBe(false);
    expect(provider.isSlackVerificationConfigured()).toBe(false);
  });

  it("accepts WITHOUT verification when no secret is configured (documented dev-only behaviour)", async () => {
    delete process.env.SLACK_SIGNING_SECRET;
    await expect(
      provider.handleWebhook("tenant-1", { type: "event_callback" }),
    ).resolves.toBeUndefined();
  });

  it("logs a url_verification challenge instead of acting on it", async () => {
    delete process.env.SLACK_SIGNING_SECRET;
    await expect(
      provider.handleWebhook("tenant-1", { type: "url_verification", challenge: "abc" }),
    ).resolves.toBeUndefined();
  });
});
