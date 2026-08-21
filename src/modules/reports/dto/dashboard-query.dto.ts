import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class DashboardQueryDto {
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
    example: '2026-08-01',
    description: 'Inclusive start date in ISO-8601 format.',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    example: '2026-08-15',
    description: 'Inclusive end date in ISO-8601 format.',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}
