import { createHmac, timingSafeEqual } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { TicketsService } from "../../tickets/tickets.service";
import { IntegrationCredentialStore } from "../credential-store.service";
import type { IntegrationProvider, ProviderKind } from "./provider.interface";

export interface WebhookConfig {
  url: string;
  secret: string;
}

export interface IncomingTicketPayload {
  projectId?: string;
  ticketId?: string;
  ticketKey?: string;
  title?: string;
  description?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}

/** HMAC-SHA256 signature over the canonical JSON payload (JSON.stringify of the parsed body). */
export function signWebhookPayload(secret: string, payload: unknown): string {
  return `sha256=${createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex")}`;
}

export function verifyWebhookPayload(
  secret: string,
  payload: unknown,
  signatureHeader: string | undefined,
): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = Buffer.from(signWebhookPayload(secret, payload), "utf8");
  const actual = Buffer.from(signatureHeader, "utf8");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * Generic webhook provider — Tier 3 escape hatch (Phase 2).
 *
 * No OAuth: a workspace configures an outgoing URL + shared secret
 * (POST /integrations/webhook/config, stored encrypted in the
 * Integration row). Outgoing: postEvent() POSTs `{ event, payload }`
 * with an `X-Agilytics-Signature: sha256=<hmac>` header so the receiver
 * can verify it. Incoming: POST /integrations/webhook/incoming accepts
 * a payload signed with the same secret and creates (or, when
 * ticketId/ticketKey is given, updates) a ticket. The tenant is found
 * by trying each active webhook connection's secret against the
 * signature — the secret IS the routing key, so it must be per-workspace
 * and unguessable.
 *
 * Zapier / Make: no separate code — both consume this same generic
 * webhook (Zapier "Webhooks by Zapier" trigger/action, Make "Custom
 * Webhook" module). See docs/INTEGRATIONS.md.
 */
@Injectable()
export class WebhookProvider implements IntegrationProvider {
  readonly provider: ProviderKind = "WEBHOOK";
  private readonly logger = new Logger(WebhookProvider.name);

  constructor(
    private readonly credentials: IntegrationCredentialStore,
    private readonly prisma: PrismaService,
    private readonly tickets: TicketsService,
  ) {}

  /** Webhooks have no OAuth flow — there is no authorise URL. */
  authorizeUrl(_tenantId: string): null {
    return null;
  }

  /**
   * connect() is not an OAuth exchange here: `code` is accepted as a
   * JSON string `{ "url": "...", "secret": "..." }` so the generic
   * POST :provider/connect route can configure a webhook too. Prefer
   * configure() / the dedicated config endpoint.
   */
  async connect(tenantId: string, code: string): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(code);
    } catch {
      throw new Error(
        'Webhook connect needs a JSON config: { "url": "https://…", "secret": "<shared secret>" }.',
      );
    }
    const cfg = parsed as Partial<WebhookConfig>;
    if (typeof cfg.url !== "string" || typeof cfg.secret !== "string") {
      throw new Error('Webhook config needs both "url" and "secret".');
    }
    await this.configure(tenantId, cfg.url, cfg.secret);
  }

  /** Store the outgoing webhook URL + shared secret (encrypted). */
  async configure(tenantId: string, url: string, secret: string): Promise<void> {
    if (!/^https?:\/\//.test(url))
      throw new Error("Webhook URL must start with http:// or https://");
    if (secret.length < 16) throw new Error("Webhook secret must be at least 16 characters");
    await this.credentials.save(tenantId, "WEBHOOK", { url, secret });
    this.logger.log(`Webhook configured for tenant ${tenantId}`);
  }

  async getConfig(tenantId: string): Promise<{ url: string } | null> {
    const stored = await this.credentials.load(tenantId, "WEBHOOK");
    return typeof stored?.url === "string" ? { url: stored.url } : null;
  }

  async disconnect(tenantId: string): Promise<void> {
    await this.credentials.clear(tenantId, "WEBHOOK");
    this.logger.log(`Webhook disconnected for tenant ${tenantId}`);
  }

  async sync(_tenantId: string): Promise<void> {
    // Nothing to pull — webhooks are push-only.
    this.logger.log("Webhook sync: no-op (push-only provider)");
  }

  /** Incoming webhook for a known tenant — same create/update logic as the public endpoint. */
  async handleWebhook(tenantId: string, payload: unknown): Promise<void> {
    await this.applyIncomingTicket(tenantId, payload as IncomingTicketPayload);
  }

  /** POST `{ event, payload }` to the workspace's webhook URL, HMAC-signed. */
  async postEvent(tenantId: string, event: string, payload: unknown): Promise<void> {
    const stored = await this.credentials.load(tenantId, "WEBHOOK");
    const url = stored?.url;
    const secret = stored?.secret;
    if (typeof url !== "string" || typeof secret !== "string") {
      throw new Error(
        "No outgoing webhook configured for this workspace: set one from the Connections page.",
      );
    }
    const body = { event, payload };
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Agilytics-Signature": signWebhookPayload(secret, body),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Outgoing webhook failed: HTTP ${res.status}`);
  }

  /**
   * Find the tenant whose webhook secret verifies this signature.
   * Returns null when no active webhook connection matches.
   */
  async findTenantForSignature(
    payload: unknown,
    signatureHeader: string | undefined,
  ): Promise<string | null> {
    if (!signatureHeader) return null;
    const rows = await this.prisma.integration.findMany({
      where: { provider: "WEBHOOK", isActive: true },
      select: { tenantId: true, encryptedCredentials: true },
    });
    for (const row of rows) {
      const stored = await this.credentials.load(row.tenantId, "WEBHOOK");
      const secret = stored?.secret;
      if (typeof secret === "string" && verifyWebhookPayload(secret, payload, signatureHeader)) {
        return row.tenantId;
      }
    }
    return null;
  }

  /**
   * Create a ticket from an incoming payload, or update one when
   * ticketId/ticketKey names an existing ticket in this tenant.
   * Payload: { projectId, title, description?, priority? } for create;
   * { ticketId | ticketKey, title?, description? } for update.
   */
  async applyIncomingTicket(tenantId: string, payload: IncomingTicketPayload) {
    if (payload.ticketId || payload.ticketKey) {
      const ticket = await this.prisma.ticket.findFirst({
        where: {
          tenantId,
          ...(payload.ticketId ? { id: payload.ticketId } : { key: payload.ticketKey }),
        },
      });
      if (!ticket) throw new Error("Ticket not found in this tenant");
      const updated = await this.prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          ...(payload.title ? { title: payload.title } : {}),
          ...(payload.description !== undefined ? { description: payload.description } : {}),
        },
      });
      // Signature-authenticated system actor (no userId): still audited,
      // so an external webhook edit is visible in the audit log.
      await this.audit(tenantId, undefined, "ticket.updated", "Ticket", ticket.id, {
        key: ticket.key,
        source: "webhook",
        ...(payload.title ? { title: payload.title } : {}),
      });
      return updated;
    }
    if (!payload.projectId)
      throw new Error("Incoming webhook ticket needs projectId (or ticketId/ticketKey to update)");
    if (!payload.title) throw new Error("Incoming webhook ticket needs a title");
    return this.tickets.create(tenantId, {
      projectId: payload.projectId,
      title: payload.title,
      description: payload.description,
      priority: payload.priority ?? "MEDIUM",
    });
  }

  /** Same audit() shape as RolesService — one AuditLog row per mutation. */
  private audit(
    tenantId: string,
    userId: string | undefined,
    action: string,
    entity: string,
    entityId: string,
    metadata: Record<string, unknown>,
  ) {
    return this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action,
        entity,
        entityId,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }
}
