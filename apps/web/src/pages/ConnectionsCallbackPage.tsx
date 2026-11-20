import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

/**
 * OAuth landing page — the API redirects here after a provider callback
 * (GET /api/v1/integrations/:provider/callback → 302 here with
 * ?provider&status&message). This page is opened in the popup/tab the
 * Connect button opened, so it tries to close itself; if the browser
 * blocks that, the user closes it manually and refreshes Connections.
 */
export function ConnectionsCallbackPage() {
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const provider = params.get("provider") ?? "Provider";
  const status = params.get("status");
  const message = params.get("message");
  const ok = status === "success";

  useEffect(() => {
    if (!ok) return;
    const t = window.setTimeout(() => window.close(), 1500);
    return () => window.clearTimeout(t);
  }, [ok]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#E9EEF5] p-6">
      <div className="w-full max-w-md rounded-[18px] border border-[#E5E7EB] bg-white p-6 text-center shadow-[0_1px_2px_rgba(17,24,39,0.04)]">
        {ok ? (
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#DCFCE7]">
            <CheckCircle2 className="h-6 w-6 text-[#16A34A]" />
          </span>
        ) : (
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#FEE2E2]">
            <XCircle className="h-6 w-6 text-[#EF4444]" />
          </span>
        )}
        <h1 className="mt-4 text-lg font-bold text-[#111827]">
          {ok ? `${provider} connected` : `${provider} could not be connected`}
        </h1>
        <p className="mt-2 text-sm text-[#6B7280]">
          {ok
            ? "This tab will close itself — refresh the Connections page to see it listed."
            : (message ??
              "The provider refused the connection. Try again from the Connections page.")}
        </p>
        <a
          href="/connections"
          className="mt-5 inline-block rounded-[10px] bg-[#6C5CE7] px-4 py-2.5 text-sm font-medium text-white shadow-[0_1px_2px_rgba(108,92,231,0.4)] transition-colors hover:bg-[#5B4BD6]"
        >
          Back to Connections
        </a>
      </div>
    </div>
  );
}
