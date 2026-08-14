import { PurchaseOrderItem } from '../entities/purchase-order-item.entity';

export interface PurchaseOrderItemResponseDto {
  id: string;
  purchaseOrderId: string;
  productVariantId: string;
  quantity: number;
  unitCostSnapshot: string;
  discountSnapshot: string;
  taxSnapshot: string;
  lineTotal: string;
  productNameSnapshot: string;
  skuSnapshot: string;
  createdAt: Date;
  updatedAt: Date;
}

export function toPurchaseOrderItemResponseDto(
  entity: PurchaseOrderItem,
): PurchaseOrderItemResponseDto {
  return {
    id: entity.id,
    purchaseOrderId: entity.purchaseOrderId,
    productVariantId: entity.productVariantId,
    quantity: entity.quantity,
    unitCostSnapshot: entity.unitCostSnapshot,
    discountSnapshot: entity.discountSnapshot,
    taxSnapshot: entity.taxSnapshot,
    lineTotal: entity.lineTotal,
    productNameSnapshot: entity.productNameSnapshot,
    skuSnapshot: entity.skuSnapshot,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}
