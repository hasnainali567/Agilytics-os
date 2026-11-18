import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantId } from "../../common/decorators/tenant.decorator";
import { StorageService } from "../../common/storage/storage.service";
import { CreateDocumentDto } from "./create-document.dto";
import { DocsService, type DocumentTemplate } from "./docs.service";
import { UpdateDocumentDto } from "./update-document.dto";

const TEMPLATES = ["PRD", "SPEC", "SPRINT_PLAN", "RETRO", "NOTE"] as const;

/**
 * Project Docs — documents live under a project, ticket or sprint
 * (FEATURE-EVALUATION #9). No global docs library, no standalone
 * docs homepage: GET /documents requires a scope. Notion docs are
 * linked via POST /documents/notion-link (escape hatch, no live
 * Notion call). Editor justification is "best PM-doc editor", not
 * "same as v1" — content stays Tiptap-shaped JSON.
 */
@ApiTags("documents")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("documents")
export class DocsController {
  constructor(
    private readonly docs: DocsService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  list(
    @TenantId() tenantId: string,
    @Query("projectId") projectId?: string,
    @Query("ticketId") ticketId?: string,
    @Query("sprintId") sprintId?: string,
    @Query("template") template?: string,
  ) {
    const parsedTemplate =
      template && (TEMPLATES as readonly string[]).includes(template)
        ? (template as DocumentTemplate)
        : undefined;
    return this.docs.list(tenantId, { projectId, ticketId, sprintId, template: parsedTemplate });
  }

  @Get(":id")
  get(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.docs.get(tenantId, id);
  }

  @Post()
  create(@TenantId() tenantId: string, @Body() body: CreateDocumentDto) {
    return this.docs.create(tenantId, body);
  }

  @Post("notion-link")
  linkNotion(@TenantId() tenantId: string, @Body() body: CreateDocumentDto) {
    if (!body.notionUrl) {
      throw new BadRequestException("notionUrl is required to link a Notion document");
    }
    return this.docs.linkNotion(tenantId, {
      title: body.title,
      notionUrl: body.notionUrl,
      projectId: body.projectId,
      ticketId: body.ticketId,
      sprintId: body.sprintId,
    });
  }

  @Patch(":id")
  update(@TenantId() tenantId: string, @Param("id") id: string, @Body() body: UpdateDocumentDto) {
    return this.docs.update(tenantId, id, body);
  }

  @Delete(":id")
  remove(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.docs.remove(tenantId, id);
  }

  @Post(":id/upload-url")
  async uploadUrl(@TenantId() tenantId: string, @Param("id") id: string) {
    await this.docs.get(tenantId, id);
    return this.storage.presignedUploadUrl("agilytics-files", `documents/${id}`);
  }
}
