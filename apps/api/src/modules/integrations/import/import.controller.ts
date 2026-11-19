import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { TenantId } from "../../../common/decorators/tenant.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { ImportService } from "./import.service";
import type { ColumnCategory } from "./import.mapping";
import type { ImportFormat, ImportSource } from "./import.types";

interface ImportBody {
  source: ImportSource;
  format: ImportFormat;
  /** File contents as text (CSV or JSON). Phase 1 accepts the file as a
   * JSON string body; multipart upload is a TODO for the web client. */
  content: string;
  /** Optional status-name → category overrides (default mapping in import.mapping.ts). */
  statusMapping?: Record<string, ColumnCategory>;
}

/**
 * Jira / ClickUp import — file-upload only (docs/INTEGRATIONS.md).
 * No live Jira/ClickUp API calls in Phase 1. Dry-run first, then import;
 * both are tenant-scoped and the run is idempotent by external id.
 */
@ApiTags("integrations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("integrations/import")
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @ApiOperation({ summary: "Dry run" })
  @ApiResponse({ status: 201, description: "Created" })
  @Post("dry-run")
  async dryRun(@TenantId() tenantId: string, @Body() body: ImportBody) {
    return this.importService.dryRun(
      tenantId,
      body.source,
      body.content,
      body.format,
      body.statusMapping,
    );
  }

  @ApiOperation({ summary: "Run" })
  @ApiResponse({ status: 201, description: "Created" })
  @Post()
  async run(@TenantId() tenantId: string, @Body() body: ImportBody) {
    // No UserId decorator exists yet; audit log records the tenant + action.
    return this.importService.runImport(
      tenantId,
      undefined,
      body.source,
      body.content,
      body.format,
      body.statusMapping,
    );
  }
}
