import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { createTicketSchema, updateTicketStatusSchema } from "@agilytics/shared";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantId } from "../../common/decorators/tenant.decorator";
import { TicketAttachmentsService } from "./ticket-attachments.service";
import { TicketLinksService } from "./ticket-links.service";
import { TicketWatchersService } from "./ticket-watchers.service";
import { TicketsService } from "./tickets.service";
import { TimeEntriesService } from "./time-entries.service";
import {
  AddWatcherDto,
  ConfirmAttachmentDto,
  CreateTicketLinkDto,
  CreateTimeEntryDto,
  RequestAttachmentUploadDto,
} from "./tickets.dto";

type ReqUser = { user?: { id?: string } };

@ApiTags("tickets")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("tickets")
export class TicketsController {
  constructor(
    private readonly tickets: TicketsService,
    private readonly links: TicketLinksService,
    private readonly watchers: TicketWatchersService,
    private readonly attachments: TicketAttachmentsService,
    private readonly timeEntries: TimeEntriesService,
  ) {}

  @Get()
  list(@TenantId() tenantId: string, @Query("projectId") projectId?: string) {
    return this.tickets.list(tenantId, projectId);
  }

  @Post()
  create(@TenantId() tenantId: string, @Req() req: ReqUser, @Body() body: unknown) {
    const parsed = createTicketSchema.parse(body);
    return this.tickets.create(tenantId, parsed, req.user?.id);
  }

  @Patch(":id/status")
  changeStatus(
    @TenantId() tenantId: string,
    @Req() req: ReqUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateTicketStatusSchema.parse(body);
    return this.tickets.changeStatus(tenantId, id, parsed.statusId, req.user?.id, parsed.note);
  }

  // --- Ticket links (dependencies) ---

  @Get(":id/links")
  listLinks(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.links.list(tenantId, id);
  }

  @Post(":id/links")
  createLink(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Body() body: CreateTicketLinkDto,
  ) {
    return this.links.create(tenantId, id, body);
  }

  @Delete(":id/links/:linkId")
  removeLink(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Param("linkId") linkId: string,
  ) {
    return this.links.remove(tenantId, id, linkId);
  }

  // --- Watchers ---

  @Get(":id/watchers")
  listWatchers(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.watchers.list(tenantId, id);
  }

  @Post(":id/watchers")
  addWatcher(
    @TenantId() tenantId: string,
    @Req() req: ReqUser,
    @Param("id") id: string,
    @Body() body: AddWatcherDto,
  ) {
    return this.watchers.add(tenantId, id, body.userId ?? req.user?.id ?? "unknown");
  }

  @Delete(":id/watchers/:userId")
  removeWatcher(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Param("userId") userId: string,
  ) {
    return this.watchers.remove(tenantId, id, userId);
  }

  // --- Attachments (S3 presigned upload, confirm on the ticket) ---

  @Get(":id/attachments")
  listAttachments(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.attachments.list(tenantId, id);
  }

  @Post(":id/attachments/upload-url")
  attachmentUploadUrl(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Body() body: RequestAttachmentUploadDto,
  ) {
    return this.attachments.requestUploadUrl(tenantId, id, body);
  }

  @Post(":id/attachments")
  confirmAttachment(
    @TenantId() tenantId: string,
    @Req() req: ReqUser,
    @Param("id") id: string,
    @Body() body: ConfirmAttachmentDto,
  ) {
    return this.attachments.confirm(tenantId, id, req.user?.id ?? "unknown", body);
  }

  @Delete(":id/attachments/:attachmentId")
  removeAttachment(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Param("attachmentId") attachmentId: string,
  ) {
    return this.attachments.remove(tenantId, id, attachmentId);
  }

  // --- Time entries ---

  @Get(":id/time-entries")
  listTimeEntries(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.timeEntries.list(tenantId, id);
  }

  @Post(":id/time-entries")
  createTimeEntry(
    @TenantId() tenantId: string,
    @Req() req: ReqUser,
    @Param("id") id: string,
    @Body() body: CreateTimeEntryDto,
  ) {
    return this.timeEntries.create(tenantId, id, req.user?.id ?? "unknown", body);
  }

  @Delete(":id/time-entries/:entryId")
  removeTimeEntry(
    @TenantId() tenantId: string,
    @Req() req: ReqUser,
    @Param("id") id: string,
    @Param("entryId") entryId: string,
  ) {
    return this.timeEntries.remove(tenantId, id, entryId, req.user?.id ?? "unknown");
  }
}
