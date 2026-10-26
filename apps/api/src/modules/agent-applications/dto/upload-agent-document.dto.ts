import { IsEnum } from 'class-validator';
import { AgentDocumentType } from '../../../generated/prisma/enums';

export class UploadAgentDocumentDto {
  @IsEnum(AgentDocumentType)
  documentType!: AgentDocumentType;
}
