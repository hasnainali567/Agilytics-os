import { describe, expect, it } from "@jest/globals";
import { buildOAuthState, verifyOAuthState } from "./oauth-state";

const SECRET = "test-state-secret";
const OTHER_SECRET = "different-state-secret";

describe("OAuth state (signed tenant binding)", () => {
  it("build/verify round-trips the tenant id", () => {
    const state = buildOAuthState("demo-tenant", SECRET);
    expect(verifyOAuthState(state, SECRET)).toBe("demo-tenant");
  });

  it("two states for the same tenant differ (random nonce)", () => {
    expect(buildOAuthState("demo-tenant", SECRET)).not.toBe(buildOAuthState("demo-tenant", SECRET));
  });

  it("a state signed with another secret is rejected", () => {
    const state = buildOAuthState("demo-tenant", SECRET);
    expect(() => verifyOAuthState(state, OTHER_SECRET)).toThrow("Invalid OAuth state");
  });

  it("a tampered tenant id is rejected", () => {
    const state = buildOAuthState("demo-tenant", SECRET);
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const tampered = Buffer.from(decoded.replace("demo-tenant", "evil-tenant"), "utf8").toString("base64url");
    expect(() => verifyOAuthState(tampered, SECRET)).toThrow("Invalid OAuth state");
  });

  it("garbage / truncated states are rejected", () => {
    expect(() => verifyOAuthState("!!!not-base64!!!", SECRET)).toThrow("Invalid OAuth state");
    expect(() => verifyOAuthState("", SECRET)).toThrow("Invalid OAuth state");
    expect(() => verifyOAuthState(Buffer.from("a.b", "utf8").toString("base64url"), SECRET)).toThrow(
      "Invalid OAuth state",
    );
  });
});
