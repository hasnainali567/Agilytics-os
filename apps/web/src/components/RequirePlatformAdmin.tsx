import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
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
      <div className="flex min-h-full items-center justify-center bg-[#E9EEF5] p-6">
        <div className="w-full max-w-md rounded-[18px] border border-[#E5E7EB] bg-white p-6 text-center shadow-[0_1px_2px_rgba(17,24,39,0.04)]">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#FEE2E2]">
            <ShieldAlert className="h-6 w-6 text-[#EF4444]" />
          </span>
          <h1 className="mt-4 text-lg font-bold text-[#111827]">
            403 — Platform admin access required
          </h1>
          <p className="mt-2 text-sm text-[#6B7280]">
            This area is for platform administrators only. Sign in with the Platform Admin test user
            on the login page.
          </p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
