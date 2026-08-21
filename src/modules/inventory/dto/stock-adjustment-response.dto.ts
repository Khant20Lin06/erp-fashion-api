import { StockAdjustment } from '../entities/stock-adjustment.entity';
import { StockAdjustmentReason } from '../entities/stock-adjustment-reason.enum';

export interface StockAdjustmentResponseDto {
  id: string;
  adjustmentNumber: string;
  warehouseId: string;
  warehouseName: string | null;
  productVariantId: string;
  productName: string | null;
  sku: string | null;
  variantLabel: string | null;
  quantityChange: number;
  quantityAfter: number | null;
  reason: StockAdjustmentReason;
  companyId: string;
  notes: string | null;
  createdBy: string;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toStockAdjustmentResponseDto(
  entity: StockAdjustment,
  extras: Partial<
    Pick<
      StockAdjustmentResponseDto,
      | 'warehouseName'
      | 'productName'
      | 'sku'
      | 'variantLabel'
      | 'quantityAfter'
      | 'createdByName'
    >
  > = {},
): StockAdjustmentResponseDto {
  return {
    id: entity.id,
    adjustmentNumber: entity.adjustmentNumber,
    warehouseId: entity.warehouseId,
    warehouseName: extras.warehouseName ?? null,
    productVariantId: entity.productVariantId,
    productName: extras.productName ?? null,
    sku: extras.sku ?? null,
    variantLabel: extras.variantLabel ?? null,
    quantityChange: entity.quantityChange,
    quantityAfter: extras.quantityAfter ?? null,
    reason: entity.reason,
    companyId: entity.companyId,
    notes: entity.notes,
    createdBy: entity.createdBy,
    createdByName: extras.createdByName ?? null,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}
