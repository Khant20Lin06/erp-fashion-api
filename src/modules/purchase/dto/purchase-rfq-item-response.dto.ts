import { PurchaseRfqItem } from '../entities/purchase-rfq-item.entity';

export interface PurchaseRfqItemResponseDto {
  id: string;
  purchaseRfqId: string;
  productVariantId: string;
  quantity: number;
  reasonSnapshot: string;
  productNameSnapshot: string;
  skuSnapshot: string;
  createdAt: Date;
  updatedAt: Date;
}

export function toPurchaseRfqItemResponseDto(
  entity: PurchaseRfqItem,
): PurchaseRfqItemResponseDto {
  return {
    id: entity.id,
    purchaseRfqId: entity.purchaseRfqId,
    productVariantId: entity.productVariantId,
    quantity: entity.quantity,
    reasonSnapshot: entity.reasonSnapshot,
    productNameSnapshot: entity.productNameSnapshot,
    skuSnapshot: entity.skuSnapshot,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}
