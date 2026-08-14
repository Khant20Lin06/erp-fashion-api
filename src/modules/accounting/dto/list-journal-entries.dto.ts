import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { JournalEntryStatus } from '../entities/journal-entry-status.enum';
import { JournalSourceType } from '../entities/journal-source-type.enum';

export class ListJournalEntriesDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsEnum(JournalEntryStatus)
  status?: JournalEntryStatus;

  @IsOptional()
  @IsEnum(JournalSourceType)
  sourceType?: JournalSourceType;

  @IsOptional()
  @IsUUID()
  sourceId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
