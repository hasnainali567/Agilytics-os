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
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-line bg-panel p-6 text-center">
        {ok ? (
          <CheckCircle2 className="mx-auto h-10 w-10 text-done" />
        ) : (
          <XCircle className="mx-auto h-10 w-10 text-risk" />
        )}
        <h1 className="mt-3 text-lg font-semibold text-ink">
          {ok ? `${provider} connected` : `${provider} could not be connected`}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {ok
            ? "This tab will close itself — refresh the Connections page to see it listed."
            : (message ?? "The provider refused the connection. Try again from the Connections page.")}
        </p>
        <a
          href="/connections"
          className="mt-5 inline-block rounded-full bg-forest px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          Back to Connections
        </a>
      </div>
    </div>
  );
}
