/** One provider = one file, same interface (see docs/INTEGRATIONS.md). */
export type ProviderKind = "SLACK" | "GITHUB" | "NOTION" | "GOOGLE_CALENDAR" | "ZAPIER" | "WEBHOOK";

export interface IntegrationProvider {
  readonly provider: ProviderKind;
  /** OAuth authorisation code → encrypted tokens stored per workspace. */
  connect(tenantId: string, code: string): Promise<void>;
  disconnect(tenantId: string): Promise<void>;
  /** Pull/push state between Agilytics and the provider. */
  sync(tenantId: string): Promise<void>;
  /** Incoming webhook from the provider (signature already verified by caller). */
  handleWebhook(tenantId: string, payload: unknown): Promise<void>;
}
