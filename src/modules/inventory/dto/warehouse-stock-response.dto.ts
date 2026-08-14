import { WarehouseStock } from '../entities/warehouse-stock.entity';

export interface WarehouseStockResponseDto {
  id: string;
  warehouseId: string;
  productVariantId: string;
  onHandQuantity: number;
  reservedQuantity: number;
  /** Computed only in the response DTO — never persisted (Phase 14 locked decision D3). */
  availableQuantity: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toWarehouseStockResponseDto(
  entity: WarehouseStock,
): WarehouseStockResponseDto {
  return {
    id: entity.id,
    warehouseId: entity.warehouseId,
    productVariantId: entity.productVariantId,
    onHandQuantity: entity.onHandQuantity,
    reservedQuantity: entity.reservedQuantity,
    availableQuantity: entity.onHandQuantity - entity.reservedQuantity,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}
