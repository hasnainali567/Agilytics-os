/** One provider = one file, same interface (see docs/INTEGRATIONS.md). */
export type ProviderKind =
  | "SLACK"
  | "GITHUB"
  | "NOTION"
  | "GOOGLE_CALENDAR"
  | "GOOGLE" // alias for GOOGLE_CALENDAR (Google provider: Calendar + Gmail + Drive)
  | "ZAPIER"
  | "WEBHOOK";

export interface IntegrationProvider {
  readonly provider: ProviderKind;
  /** OAuth authorisation code → encrypted tokens stored per workspace. */
  connect(tenantId: string, code: string): Promise<void>;
  disconnect(tenantId: string): Promise<void>;
  /** Pull/push state between Agilytics and the provider. */
  sync(tenantId: string): Promise<void>;
  /** Incoming webhook from the provider (signature already verified by caller). */
  handleWebhook(tenantId: string, payload: unknown): Promise<void>;
  /**
   * Provider authorise URL for this workspace, or null when the provider
   * is not configured (missing client id/secret env vars). The URL embeds
   * a signed `state` (see oauth-state.ts); the callback verifies it.
   * Providers without an OAuth flow (generic webhook) return null.
   */
  authorizeUrl?(tenantId: string): string | null;
}
