import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { StorageService } from "../../common/storage/storage.service";
import { PrismaService } from "../../prisma/prisma.service";
import { MAX_ATTACHMENT_BYTES } from "./tickets.dto";

/**
 * Ticket-level attachments (FEATURE-EVALUATION #29): a screenshot
 * attaches to a *ticket*, not to a wiki page. Two-step flow, bytes
 * never proxied through the API:
 *   1. POST .../attachments/upload-url → presigned S3 PUT URL + s3Key
 *   2. client PUTs the file to S3, then POST .../attachments to confirm
 * The S3 call is the existing StorageService (presigned URL only) —
 * no bucket is created here and no keys are stored in this module.
 * Deleting a row does NOT delete the S3 object: StorageService has no
 * delete method yet — orphaned objects need a worker cleanup (gap).
 */
@Injectable()
export class TicketAttachmentsService {
  private readonly bucket = process.env.FILES_BUCKET ?? "agilytics-files";

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private async assertTicketInTenant(tenantId: string, ticketId: string) {
    const ticket = await this.prisma.ticket.findFirst({ where: { id: ticketId, tenantId } });
    if (!ticket) throw new NotFoundException("Ticket not found in this tenant");
  }

  async list(tenantId: string, ticketId: string) {
    await this.assertTicketInTenant(tenantId, ticketId);
    return this.prisma.ticketAttachment.findMany({
      where: { tenantId, ticketId },
      include: { uploadedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async requestUploadUrl(
    tenantId: string,
    ticketId: string,
    input: { fileName: string; mimeType?: string; sizeBytes?: number },
  ) {
    await this.assertTicketInTenant(tenantId, ticketId);
    if (input.sizeBytes !== undefined && input.sizeBytes > MAX_ATTACHMENT_BYTES) {
      throw new BadRequestException(
        `Attachment must be ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MiB or smaller`,
      );
    }
    const safeName = input.fileName.replace(/[\\/]/g, "_").slice(0, 200);
    const s3Key = `tickets/${ticketId}/${randomUUID()}-${safeName}`;
    const uploadUrl = await this.storage.presignedUploadUrl(this.bucket, s3Key);
    return { uploadUrl, s3Key, bucket: this.bucket, expiresInSeconds: 3600 };
  }

  async confirm(
    tenantId: string,
    ticketId: string,
    uploadedById: string,
    input: { fileName: string; s3Key: string; sizeBytes?: number; mimeType?: string },
  ) {
    await this.assertTicketInTenant(tenantId, ticketId);
    if (!input.s3Key.startsWith(`tickets/${ticketId}/`)) {
      throw new BadRequestException("s3Key does not belong to this ticket");
    }
    const attachment = await this.prisma.ticketAttachment.create({
      data: { tenantId, ticketId, uploadedById, ...input },
    });
    await this.audit(
      tenantId,
      uploadedById,
      "ticket.attachment_added",
      "TicketAttachment",
      attachment.id,
      {
        ticketId,
        fileName: input.fileName,
      },
    );
    return attachment;
  }

  async remove(tenantId: string, ticketId: string, attachmentId: string, userId?: string) {
    const attachment = await this.prisma.ticketAttachment.findFirst({
      where: { id: attachmentId, tenantId, ticketId },
    });
    if (!attachment) {
      throw new NotFoundException("Attachment not found on this ticket");
    }
    await this.prisma.ticketAttachment.delete({ where: { id: attachmentId } });
    await this.audit(
      tenantId,
      userId,
      "ticket.attachment_removed",
      "TicketAttachment",
      attachmentId,
      {
        ticketId,
        fileName: attachment.fileName,
      },
    );
    return { id: attachmentId, deleted: true, s3Key: attachment.s3Key };
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
