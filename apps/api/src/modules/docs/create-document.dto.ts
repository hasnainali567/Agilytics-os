import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateDocumentDto {
  @IsString()
  @MaxLength(240)
  title!: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;
}
