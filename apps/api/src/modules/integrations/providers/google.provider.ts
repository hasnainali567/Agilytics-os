import { Injectable, Logger } from "@nestjs/common";
import { google } from "googleapis";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { TicketsService } from "../../tickets/tickets.service";
import { IntegrationCredentialStore } from "../credential-store.service";
import { buildOAuthState, getOAuthStateSecret, providerCallbackUrl } from "../oauth-state";
import type { IntegrationProvider, ProviderKind } from "./provider.interface";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
];

export interface GoogleCalendarEvent {
  id: string | null;
  summary: string | null;
  start: string | null;
  end: string | null;
  htmlLink: string | null;
}

export interface GoogleGmailMessage {
  id: string;
  subject: string | null;
  from: string | null;
  snippet: string | null;
  date: string | null;
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string | null;
  webViewLink: string | null;
}

/**
 * Google provider — Tier 1 (Phase 2: live OAuth, googleapis).
 * Stored under the Prisma enum value GOOGLE_CALENDAR (there is no bare
 * GOOGLE value in the schema enum — see credential-store normalisation).
 * One connection covers Calendar + Gmail + Drive.
 *
 * Flow: GET /integrations/GOOGLE_CALENDAR/authorize → Google consent
 * (signed state) → GET /integrations/GOOGLE_CALENDAR/callback → code
 * exchanged via OAuth2Client.getToken → tokens (incl. refresh_token)
 * encrypted (TokenVault, AES placeholder until KMS) and stored per
 * workspace. googleapis refreshes the access token automatically when
 * a refresh_token is present.
 *
 * Surfaces (small but real, all behind the "not configured" guard):
 * - Calendar: list upcoming events; create an event from a sprint deadline.
 * - Gmail: list recent messages; create a ticket from one (subject → title).
 * - Drive: list files; attach a Drive file link to a ticket (stored as a
 *   Document linked to the ticket — TicketAttachment is S3-only).
 *
 * Env (optional — blank = disabled, authorize returns 503):
 * - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET — Google OAuth client (Web application).
 * - GOOGLE_REDIRECT_URI — overrides the default callback URL (must match
 *   the URI allow-listed in the Google Cloud console).
 */
@Injectable()
export class GoogleProvider implements IntegrationProvider {
  readonly provider: ProviderKind = "GOOGLE_CALENDAR";
  private readonly logger = new Logger(GoogleProvider.name);

  constructor(
    private readonly credentials: IntegrationCredentialStore,
    private readonly prisma: PrismaService,
    private readonly tickets: TicketsService,
  ) {}

  isOAuthConfigured(): boolean {
    return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  }

  private redirectUri(): string {
    return process.env.GOOGLE_REDIRECT_URI ?? providerCallbackUrl("GOOGLE_CALENDAR");
  }

  private oauthClient() {
    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      this.redirectUri(),
    );
  }

  authorizeUrl(tenantId: string): string | null {
    if (!this.isOAuthConfigured()) return null;
    return this.oauthClient().generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: SCOPES,
      state: buildOAuthState(tenantId, getOAuthStateSecret()),
    });
  }

  /** Exchange the OAuth code for tokens and store them encrypted. */
  async connect(tenantId: string, code: string): Promise<void> {
    if (!this.isOAuthConfigured()) {
      throw new Error(
        "Google is not configured: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (see docs/INTEGRATIONS.md).",
      );
    }
    const client = this.oauthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.access_token) {
      throw new Error("Google OAuth exchange failed: no access token returned.");
    }
    await this.credentials.save(tenantId, "GOOGLE_CALENDAR", { ...tokens });
    this.logger.log(`Google connected for tenant ${tenantId}`);
  }

  async disconnect(tenantId: string): Promise<void> {
    await this.credentials.clear(tenantId, "GOOGLE_CALENDAR");
    this.logger.log(`Google disconnected for tenant ${tenantId}`);
  }

  /** Sync: verify the stored tokens still work (calendar list, 1 event). */
  async sync(tenantId: string): Promise<void> {
    const events = await this.listUpcomingEvents(tenantId, 1);
    this.logger.log(
      `Google sync for tenant ${tenantId}: ${events.length} upcoming event(s) visible`,
    );
  }

  async handleWebhook(tenantId: string, payload: unknown): Promise<void> {
    // Google push notifications (Calendar watch channels) are not wired
    // in this slice; log and ignore.
    this.logger.log(
      `Google webhook for tenant ${tenantId}: ${JSON.stringify(payload).slice(0, 200)}`,
    );
  }

  private async authedClient(tenantId: string) {
    const stored = await this.credentials.load(tenantId, "GOOGLE_CALENDAR");
    if (!stored || typeof stored.access_token !== "string" || stored.access_token.length === 0) {
      throw new Error(
        "Google is not connected for this workspace: connect Google from the Connections page.",
      );
    }
    const accessToken = stored.access_token;
    const client = this.oauthClient();
    client.setCredentials({
      access_token: accessToken,
      refresh_token: typeof stored.refresh_token === "string" ? stored.refresh_token : undefined,
      expiry_date: typeof stored.expiry_date === "number" ? stored.expiry_date : undefined,
      token_type: typeof stored.token_type === "string" ? stored.token_type : undefined,
    });
    return client;
  }

  // ---- Calendar ----

  async listUpcomingEvents(tenantId: string, maxResults = 10): Promise<GoogleCalendarEvent[]> {
    const auth = await this.authedClient(tenantId);
    const calendar = google.calendar({ version: "v3", auth });
    const { data } = await calendar.events.list({
      calendarId: "primary",
      timeMin: new Date().toISOString(),
      maxResults,
      singleEvents: true,
      orderBy: "startTime",
    });
    return (data.items ?? []).map((e) => ({
      id: e.id ?? null,
      summary: e.summary ?? null,
      start: e.start?.dateTime ?? e.start?.date ?? null,
      end: e.end?.dateTime ?? e.end?.date ?? null,
      htmlLink: e.htmlLink ?? null,
    }));
  }

  /** Create a calendar event from a sprint deadline (sprint must belong to this tenant). */
  async createEventFromSprint(tenantId: string, sprintId: string): Promise<GoogleCalendarEvent> {
    const sprint = await this.prisma.sprint.findFirst({
      where: { id: sprintId, tenantId },
      include: { project: true },
    });
    if (!sprint) throw new Error("Sprint not found in this tenant");
    const auth = await this.authedClient(tenantId);
    const calendar = google.calendar({ version: "v3", auth });
    const { data } = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: `Sprint deadline: ${sprint.project.name} — ${sprint.name}`,
        description:
          sprint.goal ?? `Sprint ${sprint.name} ends ${sprint.endDate.toISOString().slice(0, 10)}.`,
        start: { dateTime: sprint.endDate.toISOString() },
        end: { dateTime: new Date(sprint.endDate.getTime() + 60 * 60 * 1000).toISOString() },
      },
    });
    return {
      id: data.id ?? null,
      summary: data.summary ?? null,
      start: data.start?.dateTime ?? data.start?.date ?? null,
      end: data.end?.dateTime ?? data.end?.date ?? null,
      htmlLink: data.htmlLink ?? null,
    };
  }

  // ---- Gmail ----

  async listRecentMessages(tenantId: string, maxResults = 10): Promise<GoogleGmailMessage[]> {
    const auth = await this.authedClient(tenantId);
    const gmail = google.gmail({ version: "v1", auth });
    const { data } = await gmail.users.messages.list({ userId: "me", maxResults });
    const messages: GoogleGmailMessage[] = [];
    for (const m of data.messages ?? []) {
      if (!m.id) continue;
      const full = await gmail.users.messages.get({ userId: "me", id: m.id, format: "metadata" });
      const headers = full.data.payload?.headers ?? [];
      const header = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name)?.value ?? null;
      messages.push({
        id: m.id,
        subject: header("Subject"),
        from: header("From"),
        snippet: full.data.snippet ?? null,
        date: header("Date"),
      });
    }
    return messages;
  }

  /** Create a ticket from an email: subject → title, snippet/body → description. */
  async createTicketFromEmail(
    tenantId: string,
    messageId: string,
    projectId: string,
    userId?: string,
  ) {
    const auth = await this.authedClient(tenantId);
    const gmail = google.gmail({ version: "v1", auth });
    const { data } = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });
    const headers = data.payload?.headers ?? [];
    const subject =
      headers.find((h) => h.name?.toLowerCase() === "subject")?.value ?? "(no subject)";
    const from = headers.find((h) => h.name?.toLowerCase() === "from")?.value ?? "";
    const body =
      data.snippet ??
      (typeof data.payload?.body?.data === "string"
        ? Buffer.from(data.payload.body.data, "base64").toString("utf8")
        : "");
    return this.tickets.create(
      tenantId,
      {
        projectId,
        title: subject,
        description: `From email${from ? ` by ${from}` : ""} (Gmail message ${messageId}).\n\n${body}`,
        priority: "MEDIUM",
      },
      userId,
    );
  }

  // ---- Drive ----

  async listDriveFiles(tenantId: string, maxResults = 10): Promise<GoogleDriveFile[]> {
    const auth = await this.authedClient(tenantId);
    const drive = google.drive({ version: "v3", auth });
    const { data } = await drive.files.list({
      pageSize: maxResults,
      fields: "files(id, name, mimeType, webViewLink)",
      orderBy: "modifiedTime desc",
    });
    return (data.files ?? []).map((f) => ({
      id: f.id ?? "",
      name: f.name ?? "Untitled",
      mimeType: f.mimeType ?? null,
      webViewLink: f.webViewLink ?? null,
    }));
  }

  /**
   * Attach a Drive file link to a ticket — stored as a Document linked
   * to the ticket (TicketAttachment is S3-only, so a Drive link lives
   * in Project Docs instead).
   */
  async attachDriveFileToTicket(tenantId: string, ticketId: string, fileId: string) {
    const ticket = await this.prisma.ticket.findFirst({ where: { id: ticketId, tenantId } });
    if (!ticket) throw new Error("Ticket not found in this tenant");
    const files = await this.listDriveFiles(tenantId, 100);
    const file = files.find((f) => f.id === fileId);
    if (!file) throw new Error("Drive file not found");
    const doc = await this.prisma.document.create({
      data: {
        tenantId,
        projectId: ticket.projectId,
        ticketId: ticket.id,
        template: "NOTE",
        title: `Drive: ${file.name}`,
        content: {
          source: "google-drive",
          fileId: file.id,
          url: file.webViewLink,
          mimeType: file.mimeType,
        },
      },
    });
    // OAuth-delegated actor (no userId on this path): still audited.
    await this.audit(tenantId, undefined, "document.created", "Document", doc.id, {
      title: doc.title,
      source: "google-drive",
      ticketId: ticket.id,
    });
    return doc;
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
