import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { DOCUMENT_TEMPLATES } from "./docs.service";

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  title?: string;

  @IsOptional()
  @IsIn(DOCUMENT_TEMPLATES)
  template?: (typeof DOCUMENT_TEMPLATES)[number];

  @IsOptional()
  content?: unknown;
}
