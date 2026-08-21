import { StockTransfer } from '../entities/stock-transfer.entity';
import { StockTransferItem } from '../entities/stock-transfer-item.entity';

export interface StockTransferItemResponseDto {
  id: string;
  stockTransferId: string;
  productVariantId: string;
  quantity: number;
  productName: string | null;
  sku: string | null;
  variantLabel: string | null;
}

export function toStockTransferItemResponseDto(
  entity: StockTransferItem,
  extras: Partial<
    Pick<
      StockTransferItemResponseDto,
      'productName' | 'sku' | 'variantLabel'
    >
  > = {},
): StockTransferItemResponseDto {
  return {
    id: entity.id,
    stockTransferId: entity.stockTransferId,
    productVariantId: entity.productVariantId,
    quantity: entity.quantity,
    productName: extras.productName ?? null,
    sku: extras.sku ?? null,
    variantLabel: extras.variantLabel ?? null,
  };
}

export interface StockTransferResponseDto {
  id: string;
  transferNumber: string;
  sourceWarehouseId: string;
  sourceWarehouseName: string | null;
  destinationWarehouseId: string;
  destinationWarehouseName: string | null;
  companyId: string;
  notes: string | null;
  createdBy: string;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: StockTransferItemResponseDto[];
}

export function toStockTransferResponseDto(
  entity: StockTransfer,
  extras: Partial<
    Pick<
      StockTransferResponseDto,
      | 'sourceWarehouseName'
      | 'destinationWarehouseName'
      | 'createdByName'
      | 'items'
    >
  > = {},
): StockTransferResponseDto {
  return {
    id: entity.id,
    transferNumber: entity.transferNumber,
    sourceWarehouseId: entity.sourceWarehouseId,
    sourceWarehouseName: extras.sourceWarehouseName ?? null,
    destinationWarehouseId: entity.destinationWarehouseId,
    destinationWarehouseName: extras.destinationWarehouseName ?? null,
    companyId: entity.companyId,
    notes: entity.notes,
    createdBy: entity.createdBy,
    createdByName: extras.createdByName ?? null,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    items:
      extras.items ??
      (entity.items
        ? entity.items.map((item) => toStockTransferItemResponseDto(item))
        : []),
  };
}
