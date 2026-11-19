/**
 * OAuth `state` signing + redirect-URI helpers (shared by all providers).
 *
 * The state parameter binds a callback to the workspace that started the
 * flow: `base64url(tenantId) . base64url(nonce) . base64url(hmac)`, where
 * the HMAC-SHA256 covers `tenantId.nonce` with a server-side secret.
 * The callback MUST verify it and never trust a raw tenantId from the
 * query string — a forged state (or a state for another tenant) is
 * rejected before any code exchange happens.
 *
 * Secret: TOKEN_ENCRYPTION_KEY when set, else JWT_SECRET, else an
 * ephemeral in-memory secret (state then only verifies within this
 * process lifetime — fine for a flow that completes in seconds, and the
 * warning is logged once).
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

let ephemeralSecret: string | null = null;

export function getOAuthStateSecret(): string {
  const fromEnv = process.env.TOKEN_ENCRYPTION_KEY ?? process.env.JWT_SECRET;
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv;
  if (!ephemeralSecret) {
    ephemeralSecret = randomBytes(32).toString("hex");
    // eslint-disable-next-line no-console
    console.warn(
      "[oauth-state] No TOKEN_ENCRYPTION_KEY / JWT_SECRET — using an ephemeral state-signing secret. " +
        "OAuth states will only verify within this process lifetime.",
    );
  }
  return ephemeralSecret;
}

export function buildOAuthState(tenantId: string, secret: string): string {
  const nonce = randomBytes(16).toString("hex");
  const payload = `${tenantId}.${nonce}`;
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return Buffer.from(`${payload}.${sig}`, "utf8").toString("base64url");
}

/** Returns the tenantId bound to the state, or throws on any mismatch. */
export function verifyOAuthState(state: string, secret: string): string {
  let decoded: string;
  try {
    decoded = Buffer.from(state, "base64url").toString("utf8");
  } catch {
    throw new Error("Invalid OAuth state");
  }
  const parts = decoded.split(".");
  if (parts.length !== 3) throw new Error("Invalid OAuth state");
  const [tenantId, nonce, sig] = parts;
  if (!tenantId || !nonce || !sig) throw new Error("Invalid OAuth state");
  const expected = createHmac("sha256", secret).update(`${tenantId}.${nonce}`).digest("base64url");
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("Invalid OAuth state");
  }
  return tenantId;
}

/** Public base URL of this API, used to build OAuth redirect URIs. */
export function apiBaseUrl(): string {
  return (
    process.env.API_BASE ??
    process.env.API_PUBLIC_URL ??
    `http://localhost:${process.env.API_PORT ?? 3001}`
  );
}

/** Redirect URI a provider app must have allow-listed for this provider. */
export function providerCallbackUrl(provider: string): string {
  return `${apiBaseUrl()}/api/v1/integrations/${provider}/callback`;
}
