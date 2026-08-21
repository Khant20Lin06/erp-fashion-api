import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { AiKnowledgeScope } from '../entities/ai-knowledge-scope.enum';
import { AiKnowledgeStatus } from '../entities/ai-knowledge-status.enum';
import { AiKnowledgeDocument } from '../entities/ai-knowledge-document.entity';

export class CreateAiKnowledgeDocumentDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsIn(Object.values(AiKnowledgeScope))
  scope!: AiKnowledgeScope;

  @IsString()
  @MaxLength(255)
  title!: string;

  @IsString()
  @MinLength(1)
  content!: string;
}

export class ListAiKnowledgeDocumentsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsEnum(AiKnowledgeStatus)
  status?: AiKnowledgeStatus;
}

export interface AiKnowledgeDocumentResponseDto {
  id: string;
  companyId: string | null;
  scope: AiKnowledgeScope;
  title: string;
  status: AiKnowledgeStatus;
  errorMessage: string | null;
  chunkCount: number;
  embeddingModel: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toAiKnowledgeDocumentResponseDto(
  document: AiKnowledgeDocument,
): AiKnowledgeDocumentResponseDto {
  return {
    id: document.id,
    companyId: document.companyId,
    scope: document.scope,
    title: document.title,
    status: document.status,
    errorMessage: document.errorMessage,
    chunkCount: document.chunkCount,
    embeddingModel: document.embeddingModel,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}
