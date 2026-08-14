import { StockAdjustment } from '../entities/stock-adjustment.entity';
import { StockAdjustmentReason } from '../entities/stock-adjustment-reason.enum';

export interface StockAdjustmentResponseDto {
  id: string;
  adjustmentNumber: string;
  warehouseId: string;
  productVariantId: string;
  quantityChange: number;
  reason: StockAdjustmentReason;
  companyId: string;
  notes: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export function toStockAdjustmentResponseDto(
  entity: StockAdjustment,
): StockAdjustmentResponseDto {
  return {
    id: entity.id,
    adjustmentNumber: entity.adjustmentNumber,
    warehouseId: entity.warehouseId,
    productVariantId: entity.productVariantId,
    quantityChange: entity.quantityChange,
    reason: entity.reason,
    companyId: entity.companyId,
    notes: entity.notes,
    createdBy: entity.createdBy,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}
