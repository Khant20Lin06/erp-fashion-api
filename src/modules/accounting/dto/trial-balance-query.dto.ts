import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class TrialBalanceQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Optional company filter. This narrows results but never bypasses DataScope authorization.',
  })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Optional branch filter. This narrows results but never bypasses DataScope authorization.',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({
    example: '2026-08-15',
    description:
      'Include posted journal entries up to and including this ISO-8601 date.',
  })
  @IsOptional()
  @IsDateString()
  asOfDate?: string;
}
