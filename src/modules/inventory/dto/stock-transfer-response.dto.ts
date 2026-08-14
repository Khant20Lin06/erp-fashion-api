import { StockTransfer } from '../entities/stock-transfer.entity';
import { StockTransferItem } from '../entities/stock-transfer-item.entity';

export interface StockTransferItemResponseDto {
  id: string;
  stockTransferId: string;
  productVariantId: string;
  quantity: number;
}

export function toStockTransferItemResponseDto(
  entity: StockTransferItem,
): StockTransferItemResponseDto {
  return {
    id: entity.id,
    stockTransferId: entity.stockTransferId,
    productVariantId: entity.productVariantId,
    quantity: entity.quantity,
  };
}

export interface StockTransferResponseDto {
  id: string;
  transferNumber: string;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  companyId: string;
  notes: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  items?: StockTransferItemResponseDto[];
}

export function toStockTransferResponseDto(
  entity: StockTransfer,
): StockTransferResponseDto {
  return {
    id: entity.id,
    transferNumber: entity.transferNumber,
    sourceWarehouseId: entity.sourceWarehouseId,
    destinationWarehouseId: entity.destinationWarehouseId,
    companyId: entity.companyId,
    notes: entity.notes,
    createdBy: entity.createdBy,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    items: entity.items
      ? entity.items.map(toStockTransferItemResponseDto)
      : undefined,
  };
}
