import { describe, expect, it, jest } from "@jest/globals";
import { sign } from "jsonwebtoken";
import { PresenceRateLimiter } from "./presence-limiter";
import { assertTicketRoom, extractSocketToken, verifySocketToken, workspaceRoom } from "./socket-auth";

const SECRET = "test-secret";

describe("verifySocketToken (same verification as JwtAuthGuard)", () => {
  it("rejects a missing token", () => {
    expect(() => verifySocketToken(undefined, SECRET)).toThrow("Missing token");
    expect(() => verifySocketToken("", SECRET)).toThrow("Missing token");
  });

  it("rejects an invalid token", () => {
    expect(() => verifySocketToken("not-a-jwt", SECRET)).toThrow("Invalid token");
    expect(() =>
      verifySocketToken(sign({ sub: "u1", tenantId: "t1" }, "wrong-secret"), SECRET),
    ).toThrow("Invalid token");
  });

  it("accepts a dev-login JWT and reads tenantId", () => {
    const token = sign({ sub: "u1", tenantId: "tenant-1" }, SECRET);
    expect(verifySocketToken(token, SECRET)).toEqual({
      userId: "u1",
      tenantId: "tenant-1",
      platformRole: undefined,
    });
  });

  it("prefers the Cognito custom:tenant_id claim when present", () => {
    const token = sign(
      { sub: "u1", tenantId: "ignored", "custom:tenant_id": "tenant-9" },
      SECRET,
    );
    expect(verifySocketToken(token, SECRET).tenantId).toBe("tenant-9");
  });

  it("rejects a token with no subject", () => {
    const token = sign({ tenantId: "t1" }, SECRET);
    expect(() => verifySocketToken(token, SECRET)).toThrow("Invalid token");
  });
});

describe("extractSocketToken", () => {
  it("prefers handshake.auth.token over the query string", () => {
    expect(extractSocketToken({ auth: { token: "auth-token" }, query: { token: "query-token" } })).toBe(
      "auth-token",
    );
    expect(extractSocketToken({ query: { token: "query-token" } })).toBe("query-token");
    expect(extractSocketToken({})).toBeUndefined();
  });
});

describe("assertTicketRoom (cross-tenant join rejected)", () => {
  it("returns the ticket room when the ticket belongs to the socket tenant", () => {
    expect(assertTicketRoom("tenant-1", "tenant-1", "ticket-1")).toBe("ticket:ticket-1");
  });

  it("rejects a cross-tenant join", () => {
    expect(() => assertTicketRoom("tenant-2", "tenant-1", "ticket-1")).toThrow(
      /Cross-tenant ticket join rejected/,
    );
  });

  it("rejects an unknown ticket (no tenant)", () => {
    expect(() => assertTicketRoom(null, "tenant-1", "ticket-1")).toThrow(
      /Cross-tenant ticket join rejected/,
    );
  });

  it("workspaceRoom is tenant-scoped", () => {
    expect(workspaceRoom("tenant-1")).toBe("workspace:tenant-1");
  });
});

describe("PresenceRateLimiter (drop, do not queue)", () => {
  it("allows up to the limit, then drops excess pings in the window", () => {
    const limiter = new PresenceRateLimiter(3, 60_000);
    expect(limiter.allow("conn-1")).toBe(true);
    expect(limiter.allow("conn-1")).toBe(true);
    expect(limiter.allow("conn-1")).toBe(true);
    expect(limiter.allow("conn-1")).toBe(false);
    // Another connection is unaffected.
    expect(limiter.allow("conn-2")).toBe(true);
    limiter.forget("conn-1");
    expect(limiter.allow("conn-1")).toBe(true);
  });

  it("resets when the window expires", () => {
    jest.useFakeTimers();
    try {
      const limiter = new PresenceRateLimiter(1, 1_000);
      expect(limiter.allow("c")).toBe(true);
      expect(limiter.allow("c")).toBe(false);
      jest.advanceTimersByTime(1_001);
      expect(limiter.allow("c")).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
});
