import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { StockAdjustmentReason } from '../entities/stock-adjustment-reason.enum';

export class ListStockAdjustmentsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsUUID()
  productVariantId?: string;

  @IsOptional()
  @IsEnum(StockAdjustmentReason)
  reason?: StockAdjustmentReason;
}
