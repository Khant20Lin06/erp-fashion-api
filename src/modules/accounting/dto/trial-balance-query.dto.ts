import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class TrialBalanceQueryDto {
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
