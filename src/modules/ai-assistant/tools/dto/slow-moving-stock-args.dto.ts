import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class SlowMovingStockArgsDto {
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}
