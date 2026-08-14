import { GoodsReceipt } from '../entities/goods-receipt.entity';
import { GoodsReceiptItem } from '../entities/goods-receipt-item.entity';

export interface GoodsReceiptItemResponseDto {
  id: string;
  goodsReceiptId: string;
  purchaseOrderItemId: string;
  productVariantId: string;
  receivedQuantity: number;
  rejectedQuantity: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toGoodsReceiptItemResponseDto(
  entity: GoodsReceiptItem,
): GoodsReceiptItemResponseDto {
  return {
    id: entity.id,
    goodsReceiptId: entity.goodsReceiptId,
    purchaseOrderItemId: entity.purchaseOrderItemId,
    productVariantId: entity.productVariantId,
    receivedQuantity: entity.receivedQuantity,
    rejectedQuantity: entity.rejectedQuantity,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

export interface GoodsReceiptResponseDto {
  id: string;
  receiptNumber: string;
  purchaseOrderId: string;
  warehouseId: string;
  supplierId: string;
  companyId: string;
  receiptDate: Date;
  notes: string | null;
  receivedBy: string;
  createdAt: Date;
  updatedAt: Date;
  items?: GoodsReceiptItemResponseDto[];
}

export function toGoodsReceiptResponseDto(
  entity: GoodsReceipt,
): GoodsReceiptResponseDto {
  return {
    id: entity.id,
    receiptNumber: entity.receiptNumber,
    purchaseOrderId: entity.purchaseOrderId,
    warehouseId: entity.warehouseId,
    supplierId: entity.supplierId,
    companyId: entity.companyId,
    receiptDate: entity.receiptDate,
    notes: entity.notes,
    receivedBy: entity.receivedBy,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    items: entity.items
      ? entity.items.map(toGoodsReceiptItemResponseDto)
      : undefined,
  };
}
