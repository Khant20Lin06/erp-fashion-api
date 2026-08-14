import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateJournalEntryLineDto } from './create-journal-entry-line.dto';

/**
 * D12 (LOCKED): POST /journal-entries creates a DRAFT only — balance is
 * validated at posting time (POST /journal-entries/:id/post), not at
 * create time, so a user can legitimately save an in-progress unbalanced
 * draft and finish it later. sourceType/sourceId are never accepted from
 * the client (no fields for either here) — a manually created journal is
 * always sourceType=MANUAL (set server-side); PAYMENT-sourced journals are
 * only ever created by AccountingPostingService.postPayment(), never
 * through this DTO.
 */
export class CreateJournalEntryDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsDateString()
  entryDate?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  description!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateJournalEntryLineDto)
  lines!: CreateJournalEntryLineDto[];
}
