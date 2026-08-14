import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class BalanceSheetQueryDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsDateString()
  asOfDate?: string;
}
