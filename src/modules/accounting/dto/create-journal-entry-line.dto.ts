import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { JournalReferenceType } from '../entities/journal-reference-type.enum';

/** Non-negative decimal string with up to 2 decimal places, matching every prior money-field DTO's own pattern. */
const DECIMAL_PATTERN = /^\d+(\.\d{1,2})?$/;

export class CreateJournalEntryLineDto {
  @IsUUID()
  accountId!: string;

  @Matches(DECIMAL_PATTERN, {
    message:
      'debitAmount must be a non-negative decimal with up to 2 decimal places',
  })
  debitAmount!: string;

  @Matches(DECIMAL_PATTERN, {
    message:
      'creditAmount must be a non-negative decimal with up to 2 decimal places',
  })
  creditAmount!: string;

  @IsOptional()
  @IsEnum(JournalReferenceType)
  referenceType?: JournalReferenceType;

  @IsOptional()
  @IsUUID()
  referenceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
