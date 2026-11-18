import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";

export const TICKET_LINK_TYPES = ["BLOCKS", "BLOCKED_BY", "RELATES_TO", "DUPLICATES"] as const;
export type TicketLinkTypeInput = (typeof TICKET_LINK_TYPES)[number];

/** Max attachment size: 25 MiB per file. Bytes never pass through the API. */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export class CreateTicketLinkDto {
  @IsUUID()
  toTicketId!: string;

  @IsIn(TICKET_LINK_TYPES)
  type!: TicketLinkTypeInput;
}

export class AddWatcherDto {
  /** Defaults to the caller when omitted (watch the ticket myself). */
  @IsOptional()
  @IsUUID()
  userId?: string;
}

export class RequestAttachmentUploadDto {
  @IsString()
  @MaxLength(240)
  fileName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  mimeType?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_ATTACHMENT_BYTES)
  sizeBytes?: number;
}

export class ConfirmAttachmentDto {
  @IsString()
  @MaxLength(240)
  fileName!: string;

  /** Must start with `tickets/<ticketId>/` — issued by the upload-url endpoint. */
  @IsString()
  @MaxLength(512)
  s3Key!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_ATTACHMENT_BYTES)
  sizeBytes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  mimeType?: string;
}

export class CreateTimeEntryDto {
  /** Minutes logged, 1–1440 (one day). */
  @IsInt()
  @Min(1)
  @Max(1440)
  minutes!: number;

  /** Day the time is for (YYYY-MM-DD); defaults to today (UTC). Never the future. */
  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
