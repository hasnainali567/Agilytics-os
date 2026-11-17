import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantId } from "../../common/decorators/tenant.decorator";
import { StorageService } from "../../common/storage/storage.service";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateDocumentDto } from "./create-document.dto";

/** Docs — Doc Hub documents, per workspace / project. */
@ApiTags("documents")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("documents")
export class DocsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.prisma.document.findMany({ where: { tenantId }, orderBy: { updatedAt: "desc" } });
  }

  @Post()
  create(@TenantId() tenantId: string, @Body() body: CreateDocumentDto) {
    return this.prisma.document.create({
      data: { tenantId, title: body.title, projectId: body.projectId },
    });
  }

  @Post(":id/upload-url")
  uploadUrl(@Param("id") id: string) {
    return this.storage.presignedUploadUrl("agilytics-files", `documents/${id}`);
  }
}
