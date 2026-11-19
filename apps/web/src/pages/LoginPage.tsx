import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useNavigate } from "@tanstack/react-router";
import { isAuthenticated, storeSession } from "../lib/authFetch";
import type { StoredUser } from "../lib/authFetch";
import { Field, Input } from "../components/ui";
import { apiUrl } from "../lib/query-client";

/**
 * Login page — Agibankz (decision 19): canvas background, centred white
 * card, lime accents, forest-green primary button.
 *
 * DEV ONLY until Cognito lands: there is no password. Pick one of the six
 * demo users (or type its email) and the page calls the API's DEV-ONLY
 * POST /auth/dev-login, which signs a 1h JWT for that userId/tenantId.
 * The token + user are stored in localStorage by authFetch.storeSession()
 * and the app navigates to "/".
 */

interface DemoUser {
  userId: string;
  email: string;
  name: string;
  role: string;
}

const DEMO_TENANT_ID = "demo-tenant";

const DEMO_USERS: DemoUser[] = [
  { userId: "platform-admin", email: "platform@agilytics.local", name: "Platform Admin", role: "Platform Admin" },
  { userId: "owner-user", email: "owner@agilytics.local", name: "Workspace Owner", role: "Owner" },
  { userId: "admin-user", email: "admin@agilytics.local", name: "Workspace Admin", role: "Admin" },
  { userId: "lead-user", email: "lead@agilytics.local", name: "Team Lead", role: "Lead" },
  { userId: "demo-user", email: "demo@agilytics.local", name: "Demo User", role: "Member" },
  { userId: "viewer-user", email: "viewer@agilytics.local", name: "Viewer", role: "Viewer" },
];

function initialsFor(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already logged in — the router guard also redirects, this is a belt
  // and braces so the form never flashes for an authed user.
  if (isAuthenticated()) {
    return <Navigate to="/" />;
  }

  function pickUser(user: DemoUser) {
    setSelectedUserId(user.userId);
    setEmail(user.email);
    setError(null);
  }

  function onEmailChange(value: string) {
    setEmail(value);
    const match = DEMO_USERS.find((u) => u.email.toLowerCase() === value.trim().toLowerCase());
    setSelectedUserId(match ? match.userId : null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const user =
      DEMO_USERS.find((u) => u.userId === selectedUserId) ??
      DEMO_USERS.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user) {
      setError("No demo user with that email — pick one from the list below.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${apiUrl}/auth/dev-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.userId, tenantId: DEMO_TENANT_ID }),
      });
      if (!res.ok) {
        throw new Error(`Login failed: ${res.status}`);
      }
      const data = (await res.json()) as { accessToken: string };
      if (!data.accessToken) {
        throw new Error("Login failed: no token returned");
      }
      const storedUser: StoredUser = {
        userId: user.userId,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: DEMO_TENANT_ID,
      };
      storeSession(data.accessToken, storedUser);
      await navigate({ to: "/" });
    } catch (err) {
      setError(
        err instanceof Error
          ? `Could not sign in (${err.message}). Is the API running?`
          : "Could not sign in. Is the API running?",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-md rounded-[22px] border border-line bg-panel p-6 sm:p-8">
        <div className="mb-6">
          <p className="text-xl font-bold tracking-tight text-ink">Agilytics OS</p>
          <p className="mt-1 text-sm text-muted">AI-powered team OS</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Work email">
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="demo@agilytics.local"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              className="w-full bg-canvas"
            />
          </Field>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-ink">Sign in as a demo user</legend>
            <div className="space-y-2">
              {DEMO_USERS.map((user) => {
                const selected = selectedUserId === user.userId;
                return (
                  <button
                    key={user.userId}
                    type="button"
                    onClick={() => pickUser(user)}
                    aria-pressed={selected}
                    className={`flex w-full items-center gap-3 rounded-[14px] border px-3 py-2.5 text-left transition-colors ${
                      selected
                        ? "border-forest bg-lime-light/40"
                        : "border-line bg-panel hover:bg-canvas"
                    }`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lime-light text-xs font-bold text-forest">
                      {initialsFor(user.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {user.name}
                      </span>
                      <span className="block truncate text-xs text-muted">{user.email}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-pill px-2.5 py-1 text-xs font-medium text-ink">
                      {user.role}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {error ? (
            <p role="alert" className="rounded-[14px] border border-risk/40 bg-[#fff5f5] px-3 py-2 text-sm text-risk">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-forest py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-muted">
          Demo login — dev only, Cognito coming later.
        </p>
      </div>
    </div>
  );
}
