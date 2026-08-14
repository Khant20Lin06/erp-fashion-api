import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class ArApAgingQueryDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  /** Aging is computed relative to this date; defaults to "now" if omitted. */
  @IsOptional()
  @IsDateString()
  asOfDate?: string;
}
