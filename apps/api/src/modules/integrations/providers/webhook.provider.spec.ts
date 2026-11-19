import { describe, expect, it } from "@jest/globals";
import { signWebhookPayload, verifyWebhookPayload } from "./webhook.provider";

const SECRET = "webhook-shared-secret-12345";
const PAYLOAD = { projectId: "p1", title: "Fix login", priority: "HIGH" };

describe("Generic webhook HMAC signature", () => {
  it("sign/verify round-trips a payload", () => {
    expect(verifyWebhookPayload(SECRET, PAYLOAD, signWebhookPayload(SECRET, PAYLOAD))).toBe(true);
  });

  it("a different secret does not verify", () => {
    expect(verifyWebhookPayload("wrong-secret-123456", PAYLOAD, signWebhookPayload(SECRET, PAYLOAD))).toBe(
      false,
    );
  });

  it("a changed payload does not verify", () => {
    const sig = signWebhookPayload(SECRET, PAYLOAD);
    expect(verifyWebhookPayload(SECRET, { ...PAYLOAD, title: "Changed" }, sig)).toBe(false);
  });

  it("missing / malformed signatures do not verify", () => {
    expect(verifyWebhookPayload(SECRET, PAYLOAD, undefined)).toBe(false);
    expect(verifyWebhookPayload(SECRET, PAYLOAD, "not-a-signature")).toBe(false);
  });
});
