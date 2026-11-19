import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export const DOCUMENT_TEMPLATES = ["PRD", "SPEC", "SPRINT_PLAN", "RETRO", "NOTE"] as const;
export type DocumentTemplate = (typeof DOCUMENT_TEMPLATES)[number];

export interface DocumentScope {
  projectId?: string;
  ticketId?: string;
  sprintId?: string;
  template?: DocumentTemplate;
}

export interface CreateDocumentInput extends DocumentScope {
  title: string;
  content?: unknown;
  /** Link a Notion doc instead of writing one here — the escape hatch, no live Notion call. */
  notionUrl?: string;
}

export interface UpdateDocumentInput {
  title?: string;
  template?: DocumentTemplate;
  content?: unknown;
}

const TEMPLATE_HEADINGS: Record<DocumentTemplate, string[]> = {
  PRD: ["Problem", "Users", "Goals & non-goals", "Requirements", "Success metrics"],
  SPEC: ["Overview", "Requirements", "API / data changes", "Edge cases", "Testing"],
  SPRINT_PLAN: ["Sprint goal", "Scope", "Capacity", "Risks"],
  RETRO: ["What went well", "What went badly", "Action items"],
  NOTE: [],
};

/** Minimal Tiptap-shaped starter content for a template (headings, empty paragraphs). */
export function templateStarter(template: DocumentTemplate): Record<string, unknown> {
  return {
    type: "doc",
    content: TEMPLATE_HEADINGS[template].flatMap((heading) => [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: heading }] },
      { type: "paragraph", content: [] },
    ]),
  };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Project Docs (FEATURE-EVALUATION #9) — documents live under a
 * project, ticket or sprint, with a PM template. There is no global
 * docs library and no standalone docs homepage: listing requires a
 * scope (projectId / ticketId / sprintId). Notion is the escape hatch
 * for teams that already live in Notion — link a Notion doc, do not
 * rebuild Notion here. No live Notion call is made.
 */
@Injectable()
export class DocsService {
  constructor(private readonly prisma: PrismaService) {}

  private requireScope(scope: DocumentScope): void {
    if (!scope.projectId && !scope.ticketId && !scope.sprintId) {
      throw new BadRequestException(
        "Project Docs live under a project, ticket or sprint — pass projectId, ticketId or sprintId",
      );
    }
  }

  private async assertParentsInTenant(tenantId: string, scope: DocumentScope): Promise<void> {
    const checks: Promise<unknown>[] = [];
    if (scope.projectId) {
      checks.push(
        this.prisma.project.findFirst({ where: { id: scope.projectId, tenantId } }).then((p) => {
          if (!p) throw new NotFoundException("Project not found in this tenant");
        }),
      );
    }
    if (scope.ticketId) {
      checks.push(
        this.prisma.ticket.findFirst({ where: { id: scope.ticketId, tenantId } }).then((t) => {
          if (!t) throw new NotFoundException("Ticket not found in this tenant");
        }),
      );
    }
    if (scope.sprintId) {
      checks.push(
        this.prisma.sprint.findFirst({ where: { id: scope.sprintId, tenantId } }).then((s) => {
          if (!s) throw new NotFoundException("Sprint not found in this tenant");
        }),
      );
    }
    await Promise.all(checks);
  }

  async list(tenantId: string, scope: DocumentScope) {
    this.requireScope(scope);
    await this.assertParentsInTenant(tenantId, scope);
    return this.prisma.document.findMany({
      where: {
        tenantId,
        ...(scope.projectId ? { projectId: scope.projectId } : {}),
        ...(scope.ticketId ? { ticketId: scope.ticketId } : {}),
        ...(scope.sprintId ? { sprintId: scope.sprintId } : {}),
        ...(scope.template ? { template: scope.template } : {}),
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async get(tenantId: string, id: string) {
    const doc = await this.prisma.document.findFirst({ where: { id, tenantId } });
    if (!doc) throw new NotFoundException("Document not found in this tenant");
    return doc;
  }

  async create(tenantId: string, input: CreateDocumentInput, userId?: string) {
    this.requireScope(input);
    await this.assertParentsInTenant(tenantId, input);
    if (input.notionUrl !== undefined && !isHttpUrl(input.notionUrl)) {
      throw new BadRequestException("notionUrl must be an http(s) URL");
    }
    const template: DocumentTemplate = input.template ?? "NOTE";
    const content: Prisma.InputJsonValue =
      (input.content as Prisma.InputJsonValue | undefined) ??
      (input.notionUrl
        ? { source: "notion", notionUrl: input.notionUrl }
        : (templateStarter(template) as unknown as Prisma.InputJsonValue));
    const doc = await this.prisma.document.create({
      data: {
        tenantId,
        title: input.title,
        projectId: input.projectId,
        ticketId: input.ticketId,
        sprintId: input.sprintId,
        template,
        content,
      },
    });
    await this.audit(tenantId, userId, "document.created", "Document", doc.id, {
      title: doc.title,
      template: doc.template,
      ...(input.notionUrl ? { notionUrl: input.notionUrl } : {}),
    });
    return doc;
  }

  /** Link a Notion doc under a project/ticket/sprint — stored, never fetched. */
  linkNotion(
    tenantId: string,
    input: { title: string; notionUrl: string } & DocumentScope,
    userId?: string,
  ) {
    return this.create(
      tenantId,
      { ...input, template: "NOTE", notionUrl: input.notionUrl },
      userId,
    );
  }

  async update(tenantId: string, id: string, input: UpdateDocumentInput, userId?: string) {
    await this.get(tenantId, id);
    const doc = await this.prisma.document.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.template !== undefined ? { template: input.template } : {}),
        ...(input.content !== undefined ? { content: input.content as Prisma.InputJsonValue } : {}),
      },
    });
    await this.audit(tenantId, userId, "document.updated", "Document", id, {
      title: doc.title,
    });
    return doc;
  }

  async remove(tenantId: string, id: string, userId?: string) {
    const doc = await this.get(tenantId, id);
    await this.prisma.document.delete({ where: { id } });
    await this.audit(tenantId, userId, "document.deleted", "Document", id, {
      title: doc.title,
    });
    return { id, deleted: true };
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
