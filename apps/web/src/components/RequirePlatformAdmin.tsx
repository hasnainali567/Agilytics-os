import type { ReactNode } from "react";

/**
 * Platform-admin route guard.
 * Reads the platform role from the auth session (Cognito JWT `platformRole`
 * claim) once auth is wired. Until then there is no user, so access is
 * denied — there is deliberately no mocked admin user and no backdoor.
 */
export function RequirePlatformAdmin({ children }: { children: ReactNode }) {
  const platformRole: string | null = null; // TODO: read from auth store (Cognito JWT)
  if (platformRole !== "PLATFORM_ADMIN") {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold">403 — Platform admin access required</h1>
        <p className="text-sm text-muted">
          This area is for platform administrators only. Sign in with a PLATFORM_ADMIN account once
          Cognito auth is wired (see apps/api README).
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
