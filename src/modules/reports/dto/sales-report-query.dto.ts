import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class SalesReportQueryDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsString()
  granularity?: string;

  @IsOptional()
  @IsIn(['unitsSold', 'revenue'])
  sortBy?: 'unitsSold' | 'revenue';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortDirection?: 'ASC' | 'DESC';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
