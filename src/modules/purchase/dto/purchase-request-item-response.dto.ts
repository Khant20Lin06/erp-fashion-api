import { PurchaseRequestItem } from '../entities/purchase-request-item.entity';

export interface PurchaseRequestItemResponseDto {
  id: string;
  purchaseRequestId: string;
  productVariantId: string;
  quantity: number;
  reason: string;
  productNameSnapshot: string;
  skuSnapshot: string;
  createdAt: Date;
  updatedAt: Date;
}

export function toPurchaseRequestItemResponseDto(
  entity: PurchaseRequestItem,
): PurchaseRequestItemResponseDto {
  return {
    id: entity.id,
    purchaseRequestId: entity.purchaseRequestId,
    productVariantId: entity.productVariantId,
    quantity: entity.quantity,
    reason: entity.reason,
    productNameSnapshot: entity.productNameSnapshot,
    skuSnapshot: entity.skuSnapshot,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}
