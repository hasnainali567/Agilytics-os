import { apiUrl } from "./query-client";

/**
 * Authenticated fetch for the web app — NO auto-login.
 *
 * The session is created explicitly by the login page: it POSTs to the
 * API's DEV-ONLY /auth/dev-login endpoint and stores the returned JWT in
 * localStorage. This module only ever *reads* that stored token — it never
 * calls dev-login itself, so an unauthenticated user is never silently
 * logged in as the demo user.
 *
 * When Cognito lands, the login page will store a Cognito token under the
 * same key and this module needs no change. Until then the stored token
 * is a dev JWT (1h expiry, signed with the API's JWT_SECRET).
 */

export const TOKEN_KEY = "agilytics.accessToken";
export const USER_KEY = "agilytics.user";

export interface StoredUser {
  userId: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
}

/** Read the stored token from localStorage only. Returns null when logged out. */
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}

/** The user saved at login time, or null when logged out / corrupt. */
export function getCurrentUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredUser;
    if (!parsed || typeof parsed.userId !== "string" || typeof parsed.email !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Persist a session after a successful login. Called by LoginPage only. */
export function storeSession(accessToken: string, user: StoredUser): void {
  try {
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // localStorage unavailable — the session just won't survive a reload.
  }
}

/** Clear the stored session (token + user). */
export function logout(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // Nothing stored, or localStorage unavailable — already logged out.
  }
}

function clearSessionAndGoToLogin(): void {
  logout();
  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

function resolveUrl(urlOrPath: string): string {
  return urlOrPath.startsWith("http") ? urlOrPath : `${apiUrl}${urlOrPath}`;
}

/**
 * Drop-in replacement for fetch() against the API — adds the Bearer token
 * when one is stored. Never logs in on its own: with no token the request
 * goes out unauthenticated, and a 401 clears the session and sends the
 * browser to /login instead of retrying.
 */
export async function apiFetch(urlOrPath: string, init?: RequestInit): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(resolveUrl(urlOrPath), { ...init, headers });
  if (res.status === 401) {
    // Token expired, rejected, or never existed — force a fresh login.
    clearSessionAndGoToLogin();
  }
  return res;
}
