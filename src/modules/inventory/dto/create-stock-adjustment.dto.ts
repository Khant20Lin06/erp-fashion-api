import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  NotEquals,
} from 'class-validator';
import { StockAdjustmentReason } from '../entities/stock-adjustment-reason.enum';

export class CreateStockAdjustmentDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsUUID()
  warehouseId!: string;

  @IsUUID()
  productVariantId!: string;

  /** Signed, nonzero — a zero adjustment is meaningless and rejected (400). */
  @IsInt()
  @NotEquals(0)
  quantityChange!: number;

  @IsEnum(StockAdjustmentReason)
  reason!: StockAdjustmentReason;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
