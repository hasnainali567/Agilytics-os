import { IsIn, IsOptional, IsString, IsUrl, IsUUID, MaxLength } from "class-validator";
import { DOCUMENT_TEMPLATES } from "./docs.service";

export class CreateDocumentDto {
  @IsString()
  @MaxLength(240)
  title!: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  ticketId?: string;

  @IsOptional()
  @IsUUID()
  sprintId?: string;

  /** PM template: PRD | SPEC | SPRINT_PLAN | RETRO | NOTE (default). */
  @IsOptional()
  @IsIn(DOCUMENT_TEMPLATES)
  template?: (typeof DOCUMENT_TEMPLATES)[number];

  /** Tiptap JSON content; defaults to the template starter. */
  @IsOptional()
  content?: unknown;

  /** Link a Notion doc (escape hatch) instead of writing one here. No live Notion call. */
  @IsOptional()
  @IsUrl({ require_protocol: true })
  notionUrl?: string;
}
