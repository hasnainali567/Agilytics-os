/** One provider = one file, same interface (see docs/INTEGRATIONS.md). */
export type ProviderKind =
  | "SLACK"
  | "GITHUB"
  | "NOTION"
  | "GOOGLE_CALENDAR"
  | "GOOGLE" // alias for GOOGLE_CALENDAR (Google provider: Calendar + Gmail + Drive)
  | "ZAPIER"
  | "WEBHOOK";

/**
 * Raw request material a provider's incoming-webhook verification needs.
 * The controller passes these through from the HTTP request — the
 * signature must be checked over the exact bytes the sender signed
 * (`rawBody`, enabled by `rawBody: true` in main.ts), never over a
 * re-serialised parsed body.
 */
export interface IncomingWebhookOpts {
  /** Raw request body bytes (Buffer when `rawBody: true`). */
  rawBody?: string | Buffer;
  /** Provider timestamp header (Slack `X-Slack-Request-Timestamp`). */
  timestamp?: string;
  /** Provider signature header (Slack `X-Slack-Signature`, GitHub `X-Hub-Signature-256`). */
  signature?: string;
}

export interface IntegrationProvider {
  readonly provider: ProviderKind;
  /** OAuth authorisation code → encrypted tokens stored per workspace. */
  connect(tenantId: string, code: string): Promise<void>;
  disconnect(tenantId: string): Promise<void>;
  /** Pull/push state between Agilytics and the provider. */
  sync(tenantId: string): Promise<void>;
  /**
   * Incoming webhook from the provider. `opts` carries the raw body +
   * signature headers; each provider verifies its own signature and
   * rejects (401) when its secret is configured and verification fails.
   * When no secret is configured the provider logs a warning and
   * proceeds (dev-only behaviour).
   */
  handleWebhook(tenantId: string, payload: unknown, opts?: IncomingWebhookOpts): Promise<void>;
  /**
   * Provider authorise URL for this workspace, or null when the provider
   * is not configured (missing client id/secret env vars). The URL embeds
   * a signed `state` (see oauth-state.ts); the callback verifies it.
   * Providers without an OAuth flow (generic webhook) return null.
   */
  authorizeUrl?(tenantId: string): string | null;
}
