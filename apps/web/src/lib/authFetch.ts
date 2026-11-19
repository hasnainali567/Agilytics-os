import { apiUrl } from "./query-client";

/**
 * Authenticated fetch for the web app — DEV ONLY until Cognito lands.
 *
 * Every API endpoint is behind JwtAuthGuard, but the web app sent no
 * Authorization header at all, so every call 401'd and the dashboard
 * showed "The API isn't reachable" even though the API was up (the
 * public /health endpoint worked, which is what made this confusing).
 *
 * Until Cognito is wired, this obtains a local JWT from the API's
 * DEV-ONLY POST /auth/dev-login endpoint (user demo-user, tenant
 * demo-tenant — the seeded demo org) and attaches it as a Bearer token.
 * The token is cached in memory and refreshed once on 401. When
 * Cognito env vars are set, dev-login is skipped and a stored token
 * from localStorage is used instead.
 */

const TOKEN_KEY = "agilytics.accessToken";
const DEV_USER_ID = "demo-user";
const DEV_TENANT_ID =
  (import.meta.env.VITE_DEV_TENANT_ID as string | undefined) ?? "demo-tenant";

let cachedToken: string | null = null;
let cachedUntil = 0;

function cognitoConfigured(): boolean {
  return Boolean(import.meta.env.VITE_COGNITO_USER_POOL_ID);
}

async function devLogin(): Promise<string> {
  const res = await fetch(`${apiUrl}/auth/dev-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: DEV_USER_ID, tenantId: DEV_TENANT_ID }),
  });
  if (!res.ok) {
    throw new Error(`Dev login failed: ${res.status}`);
  }
  const data = (await res.json()) as { accessToken: string; expiresIn?: number };
  cachedToken = data.accessToken;
  cachedUntil = Date.now() + ((data.expiresIn ?? 3600) - 60) * 1000;
  try {
    localStorage.setItem(TOKEN_KEY, cachedToken);
  } catch {
    // localStorage unavailable (SSR/tests) — memory cache is enough.
  }
  return cachedToken;
}

async function getToken(): Promise<string | null> {
  if (cognitoConfigured()) {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }
  if (cachedToken && Date.now() < cachedUntil) return cachedToken;
  try {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      cachedToken = stored;
      cachedUntil = Date.now() + 50 * 60 * 1000;
      return stored;
    }
  } catch {
    // fall through to dev-login
  }
  return devLogin();
}

function resolveUrl(urlOrPath: string): string {
  return urlOrPath.startsWith("http") ? urlOrPath : `${apiUrl}${urlOrPath}`;
}

/** Drop-in replacement for fetch() against the API — adds the Bearer token. */
export async function apiFetch(urlOrPath: string, init?: RequestInit): Promise<Response> {
  const token = await getToken();
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res = await fetch(resolveUrl(urlOrPath), { ...init, headers });
  if (res.status === 401 && !cognitoConfigured()) {
    // Token expired or rejected — log in once more and retry a single time.
    cachedToken = null;
    cachedUntil = 0;
    const retryToken = await devLogin();
    res = await fetch(resolveUrl(urlOrPath), {
      ...init,
      headers: { ...headers, Authorization: `Bearer ${retryToken}` },
    });
  }
  return res;
}
