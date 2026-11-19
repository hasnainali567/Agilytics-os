import type { ReactNode } from "react";
import { getCurrentUser } from "../lib/authFetch";

/**
 * Platform-admin route guard.
 * Reads the platform role from the logged-in demo user (the LoginPage
 * stores role "Platform Admin" for platform-admin; in production this
 * comes from the Cognito JWT `platformRole` claim). The API enforces
 * the same via PlatformAdminGuard + the dev-login claim.
 */
export function RequirePlatformAdmin({ children }: { children: ReactNode }) {
  const user = getCurrentUser();
  const isPlatformAdmin =
    user?.userId === "platform-admin" ||
    user?.role === "PLATFORM_ADMIN" ||
    user?.role === "Platform Admin";
  if (!isPlatformAdmin) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold">403 — Platform admin access required</h1>
        <p className="text-sm text-muted">
          This area is for platform administrators only. Sign in with the Platform Admin test
          user on the login page.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
