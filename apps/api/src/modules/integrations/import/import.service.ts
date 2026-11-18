import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  buildDryRunReport,
  mapPriority,
  mapStatusToCategory,
  mapTicketType,
  parseImportFile,
  validateImport,
  type ColumnCategory,
} from "./import.mapping";
import type { DryRunReport, ImportFormat, ImportResult, ImportSource } from "./import.types";

/**
 * Jira / ClickUp import — file-upload only, Phase 1.
 *
 * - `dryRun` parses + validates and reports what WOULD happen. No writes.
 * - `runImport` writes, tenant-scoped throughout, and is idempotent:
 *   a re-import of the same file skips projects (tenant + key), tickets
 *   (project + external id, stored in `customFields.externalId` — there
 *   is no external-id column in the schema, and this slice does not edit
 *   schema.prisma) and columns (board + name). Parent links resolve in
 *   a second pass so child-before-parent order in the file does not matter.
 * - Attachments are NOT imported from CSV/JSON (no file bytes in the
 *   export); the result says so instead of silently dropping them.
 * - Unknown users are NOT given accounts: see ImportResult.unmappedUsers.
 * - Every run is written to AuditLog (`import.run`, tenant scoped).
 */
@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);
  private static readonly MAX_FILE_CHARS = 5_000_000; // ~5 MB of text

  constructor(private readonly prisma: PrismaService) {}

  /** Parse + validate only — no database writes (membership lookup only). */
  async dryRun(
    tenantId: string,
    source: ImportSource,
    content: string,
    format: ImportFormat,
    customMapping?: Record<string, ColumnCategory>,
  ): Promise<DryRunReport> {
    this.assertSource(source);
    this.assertSize(content);
    const data = parseImportFile(content, format, source);
    const report = buildDryRunReport(data, format, customMapping);
    // Real unmapped users: file users with no member in this tenant.
    const memberships = await this.prisma.membership.findMany({
      where: { tenantId },
      include: { user: { select: { email: true } } },
    });
    const memberEmails = new Set(memberships.map((m) => m.user.email.toLowerCase()));
    report.unmappedUsers = [...new Set(data.users.map((u) => u.email))].filter(
      (email) => !memberEmails.has(email.toLowerCase()),
    );
    return report;
  }

  async runImport(
    tenantId: string,
    userId: string | undefined,
    source: ImportSource,
    content: string,
    format: ImportFormat,
    customMapping?: Record<string, ColumnCategory>,
  ): Promise<ImportResult> {
    this.assertSource(source);
    this.assertSize(content);
    const data = parseImportFile(content, format, source);
    const issues = validateImport(data);
    const errors = issues.filter((i) => i.severity === "error");
    // Project and ticket rows are indexed separately in validateImport,
    // so partition error rows by field (project: key/name, ticket: rest).
    const projectErrorRows = new Set(
      errors.filter((e) => e.field === "key" || e.field === "name").map((e) => e.row),
    );
    const ticketErrorRows = new Set(
      errors
        .filter((e) => e.field !== "key" && e.field !== "name" && e.field !== "email")
        .map((e) => e.row),
    );

    const result: ImportResult = {
      source,
      createdProjects: 0,
      existingProjects: 0,
      createdTickets: 0,
      skippedExistingTickets: 0,
      linkedParents: 0,
      columnsCreated: 0,
      unmappedUsers: [],
      errors,
    };

    // Tenant member lookup for assignees (email → user id), once.
    const memberEmails = new Map<string, string>();
    const memberships = await this.prisma.membership.findMany({
      where: { tenantId },
      include: { user: { select: { id: true, email: true } } },
    });
    for (const m of memberships) memberEmails.set(m.user.email.toLowerCase(), m.user.id);

    const projectIds = new Map<string, string>(); // project key → id
    const boardIds = new Map<string, string>(); // project key → board id
    const columnIds = new Map<string, string>(); // `${projectKey}:${status}` → column id

    for (const [i, p] of data.projects.entries()) {
      if (projectErrorRows.has(i)) continue;
      const key = p.key.trim().toUpperCase();
      let project = await this.prisma.project.findUnique({
        where: { tenantId_key: { tenantId, key } },
      });
      if (project) {
        result.existingProjects++;
      } else {
        project = await this.prisma.project.create({
          data: { tenantId, key, name: p.name.trim() || key, description: p.description },
        });
        result.createdProjects++;
      }
      projectIds.set(key, project.id);
      boardIds.set(key, await this.ensureBoard(tenantId, project.id));
    }

    // Columns first: one per distinct status name, name preserved verbatim.
    for (const t of data.tickets) {
      const projectKey = t.projectKey.trim().toUpperCase();
      const boardId = boardIds.get(projectKey);
      if (!boardId || !t.status.trim()) continue;
      const mapKey = `${projectKey}:${t.status}`;
      if (columnIds.has(mapKey)) continue;
      const existing = await this.prisma.boardColumn.findFirst({
        where: { boardId, name: t.status },
      });
      if (existing) {
        columnIds.set(mapKey, existing.id);
        continue;
      }
      const count = await this.prisma.boardColumn.count({ where: { boardId } });
      const column = await this.prisma.boardColumn.create({
        data: {
          tenantId,
          boardId,
          name: t.status,
          order: count,
          category: mapStatusToCategory(t.status, source, customMapping),
        },
      });
      columnIds.set(mapKey, column.id);
      result.columnsCreated++;
    }

    // Tickets, then parents in a second pass.
    const ticketIdsByExternal = new Map<string, string>();
    for (const [i, t] of data.tickets.entries()) {
      if (ticketErrorRows.has(i)) continue;
      const projectKey = t.projectKey.trim().toUpperCase();
      const projectId = projectIds.get(projectKey);
      if (!projectId) continue;

      const existingByExternal = await this.prisma.ticket.findFirst({
        where: { projectId, customFields: { path: ["externalId"], equals: t.externalId } },
        select: { id: true },
      });
      if (existingByExternal) {
        result.skippedExistingTickets++;
        ticketIdsByExternal.set(t.externalId, existingByExternal.id);
        continue;
      }
      const key =
        t.externalKey && t.externalKey.toUpperCase().startsWith(`${projectKey}-`)
          ? t.externalKey.toUpperCase()
          : await this.nextTicketKey(tenantId, projectId, projectKey);
      const byKey = await this.prisma.ticket.findUnique({
        where: { projectId_key: { projectId, key } },
        select: { id: true },
      });
      if (byKey) {
        result.skippedExistingTickets++;
        ticketIdsByExternal.set(t.externalId, byKey.id);
        continue;
      }

      const assigneeId = t.assigneeEmail
        ? memberEmails.get(t.assigneeEmail.toLowerCase())
        : undefined;
      if (t.assigneeEmail && !assigneeId && !result.unmappedUsers.includes(t.assigneeEmail)) {
        result.unmappedUsers.push(t.assigneeEmail);
      }
      const statusId = columnIds.get(`${projectKey}:${t.status}`);
      const created = await this.prisma.ticket.create({
        data: {
          tenantId,
          projectId,
          boardId: boardIds.get(projectKey),
          statusId,
          key,
          type: mapTicketType(t.type),
          title: t.title,
          description: t.description,
          priority: mapPriority(t.priority),
          assigneeId,
          dueDate:
            t.dueDate && !Number.isNaN(Date.parse(t.dueDate)) ? new Date(t.dueDate) : undefined,
          labels: t.labels ?? [],
          customFields: {
            importedFrom: source,
            externalId: t.externalId,
            ...(t.externalKey ? { externalKey: t.externalKey } : {}),
            ...(t.assigneeEmail && !assigneeId ? { externalAssignee: t.assigneeEmail } : {}),
            ...(t.assigneeName ? { externalAssigneeName: t.assigneeName } : {}),
          },
        },
      });
      result.createdTickets++;
      ticketIdsByExternal.set(t.externalId, created.id);
    }

    for (const t of data.tickets) {
      if (!t.parentExternalId) continue;
      const childId = ticketIdsByExternal.get(t.externalId);
      const parentId = ticketIdsByExternal.get(t.parentExternalId);
      if (!childId || !parentId || childId === parentId) continue;
      await this.prisma.ticket.update({ where: { id: childId }, data: { parentId } });
      result.linkedParents++;
    }

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: "import.run",
        entity: "IntegrationImport",
        metadata: {
          source,
          format,
          createdProjects: result.createdProjects,
          createdTickets: result.createdTickets,
          skippedExistingTickets: result.skippedExistingTickets,
          unmappedUsers: result.unmappedUsers,
        },
      },
    });
    this.logger.log(
      `Import ${source} for tenant ${tenantId}: ${result.createdTickets} tickets created, ${result.skippedExistingTickets} skipped`,
    );
    return result;
  }

  private assertSource(source: ImportSource) {
    if (source !== "JIRA" && source !== "CLICKUP") {
      throw new Error(`Unknown import source "${String(source)}" (expected JIRA or CLICKUP)`);
    }
  }

  private assertSize(content: string) {
    if (content.length > ImportService.MAX_FILE_CHARS) {
      throw new Error("Import file is too large (max ~5 MB of text for Phase 1)");
    }
  }

  private async ensureBoard(tenantId: string, projectId: string): Promise<string> {
    const existing = await this.prisma.board.findFirst({
      where: { tenantId, projectId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    if (existing) return existing.id;
    const board = await this.prisma.board.create({
      data: { tenantId, projectId, name: "Imported Board", isDefault: true },
    });
    return board.id;
  }

  /** Next free `${projectKey}-${n}` key, from the highest existing number. */
  private async nextTicketKey(
    tenantId: string,
    projectId: string,
    projectKey: string,
  ): Promise<string> {
    const tickets = await this.prisma.ticket.findMany({
      where: { tenantId, projectId },
      select: { key: true },
    });
    let max = 0;
    for (const t of tickets) {
      const m = t.key.match(new RegExp(`^${projectKey}-(\\d+)$`));
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return `${projectKey}-${max + 1}`;
  }
}
