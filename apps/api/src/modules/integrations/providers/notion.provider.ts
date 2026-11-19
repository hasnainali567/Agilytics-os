import { Injectable, Logger } from "@nestjs/common";
import { Client } from "@notionhq/client";
import { IntegrationCredentialStore } from "../credential-store.service";
import { buildOAuthState, getOAuthStateSecret, providerCallbackUrl } from "../oauth-state";
import type { IntegrationProvider, ProviderKind } from "./provider.interface";

export interface NotionLinkedItem {
  id: string;
  type: "page" | "database";
  title: string;
  url: string | null;
  projectId?: string | null;
}

/**
 * Notion provider — Tier 1 (Phase 2: live OAuth).
 *
 * Flow: GET /integrations/NOTION/authorize → Notion authorise URL
 * (signed state) → POST /v1/oauth/token with Basic auth
 * (client_id:client_secret) → bot token encrypted (TokenVault, AES
 * placeholder until KMS) and stored per workspace.
 *
 * sync() lists the pages/databases the integration can see and stores
 * them as link records in the encrypted credential JSON (`links`) —
 * no new table; Project Docs embeds them from there. linkDatabase()
 * pins one page/database to a project.
 *
 * Env (optional — blank = disabled, authorize returns 503):
 * - NOTION_CLIENT_ID / NOTION_CLIENT_SECRET — Notion integration OAuth credentials.
 *
 * Notion has no generic incoming webhook; handleWebhook is a documented
 * no-op (Notion automations call our generic webhook instead).
 */
@Injectable()
export class NotionProvider implements IntegrationProvider {
  readonly provider: ProviderKind = "NOTION";
  private readonly logger = new Logger(NotionProvider.name);

  constructor(private readonly credentials: IntegrationCredentialStore) {}

  isOAuthConfigured(): boolean {
    return Boolean(process.env.NOTION_CLIENT_ID && process.env.NOTION_CLIENT_SECRET);
  }

  authorizeUrl(tenantId: string): string | null {
    const clientId = process.env.NOTION_CLIENT_ID;
    if (!clientId || !process.env.NOTION_CLIENT_SECRET) return null;
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      owner: "user",
      redirect_uri: providerCallbackUrl("NOTION"),
      state: buildOAuthState(tenantId, getOAuthStateSecret()),
    });
    return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
  }

  /** Exchange the OAuth code for a bot token and store it encrypted. */
  async connect(tenantId: string, code: string): Promise<void> {
    const clientId = process.env.NOTION_CLIENT_ID;
    const clientSecret = process.env.NOTION_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error(
        "Notion is not configured: set NOTION_CLIENT_ID and NOTION_CLIENT_SECRET (see docs/INTEGRATIONS.md).",
      );
    }
    const basic = Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64");
    const res = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Basic ${basic}`,
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: providerCallbackUrl("NOTION"),
      }),
    });
    if (!res.ok) throw new Error(`Notion OAuth exchange failed: HTTP ${res.status}`);
    const data = (await res.json()) as {
      access_token?: string;
      bot_id?: string;
      workspace_id?: string;
      workspace_name?: string;
      error?: string;
    };
    if (!data.access_token) {
      throw new Error(`Notion OAuth exchange failed: ${data.error ?? "no access token returned"}`);
    }
    await this.credentials.save(tenantId, "NOTION", {
      access_token: data.access_token,
      bot_id: data.bot_id ?? null,
      workspace_id: data.workspace_id ?? null,
      workspace_name: data.workspace_name ?? null,
      links: [],
    });
    this.logger.log(`Notion connected for tenant ${tenantId}`);
  }

  async disconnect(tenantId: string): Promise<void> {
    await this.credentials.clear(tenantId, "NOTION");
    this.logger.log(`Notion disconnected for tenant ${tenantId}`);
  }

  /** List accessible pages/databases and store them as link records. */
  async sync(tenantId: string): Promise<void> {
    const items = await this.listAccessible(tenantId);
    await this.credentials.merge(tenantId, "NOTION", { links: items });
    this.logger.log(`Notion sync for tenant ${tenantId}: ${items.length} pages/databases linked`);
  }

  async handleWebhook(_tenantId: string, _payload: unknown): Promise<void> {
    // No-op by design: Notion offers no generic incoming webhook.
    // Notion automations should POST to our generic webhook endpoint
    // (see WebhookProvider / docs/INTEGRATIONS.md § Webhooks).
    this.logger.log("Notion handleWebhook: no-op (Notion has no incoming webhooks)");
  }

  private async clientForTenant(tenantId: string): Promise<Client> {
    const stored = await this.credentials.load(tenantId, "NOTION");
    const token = stored?.access_token;
    if (typeof token !== "string" || token.length === 0) {
      throw new Error(
        "Notion is not connected for this workspace: connect Notion from the Connections page.",
      );
    }
    return new Client({ auth: token });
  }

  /** Pages/databases the Notion integration can see (real @notionhq/client call). */
  async listAccessible(tenantId: string): Promise<NotionLinkedItem[]> {
    const client = await this.clientForTenant(tenantId);
    const { results } = await client.search({});
    return results.map((r) => {
      // @notionhq/client v5: search returns pages and data sources
      // (databases are `data_source` objects in this SDK version).
      const isDb = r.object === "data_source";
      const title =
        (r as { title?: { plain_text?: string }[] }).title?.map((t) => t.plain_text ?? "").join("") ??
        (r as { properties?: { title?: { title?: { plain_text?: string }[] } } }).properties
          ?.title?.title?.map((t) => t.plain_text ?? "")
          .join("") ??
        "Untitled";
      return {
        id: r.id,
        type: isDb ? ("database" as const) : ("page" as const),
        title,
        url: (r as { url?: string }).url ?? null,
      };
    });
  }

  /** Link records stored by the last sync (plus any pinned to projects). */
  async listLinks(tenantId: string): Promise<NotionLinkedItem[]> {
    const stored = await this.credentials.load(tenantId, "NOTION");
    const links = stored?.links;
    return Array.isArray(links) ? (links as NotionLinkedItem[]) : [];
  }

  /** Pin one accessible page/database to a project (stored in the link record). */
  async linkToProject(
    tenantId: string,
    itemId: string,
    projectId: string,
  ): Promise<NotionLinkedItem[]> {
    const items = await this.listAccessible(tenantId);
    const item = items.find((i) => i.id === itemId);
    if (!item) throw new Error("Notion page/database not found or not shared with the integration");
    const links = await this.listLinks(tenantId);
    const next = [
      ...links.filter((l) => l.id !== itemId),
      { ...item, projectId },
    ];
    await this.credentials.merge(tenantId, "NOTION", { links: next });
    return next;
  }
}
