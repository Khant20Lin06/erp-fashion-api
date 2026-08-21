import { IsDateString, IsOptional } from 'class-validator';

/** Shared validated shape for every tool's optional date-range arguments — never trusted raw from the LLM without this pass. */
export class DateRangeArgsDto {
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}

export class AsOfDateArgsDto {
  @IsOptional()
  @IsDateString()
  asOfDate?: string;
}
