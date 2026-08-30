import { PurchaseOrderItem } from '../entities/purchase-order-item.entity';

export interface PurchaseOrderItemResponseDto {
  id: string;
  purchaseOrderId: string;
  productVariantId: string;
  uomId: string | null;
  uomCodeSnapshot: string | null;
  uomNameSnapshot: string | null;
  quantity: number;
  baseQuantitySnapshot: number;
  unitCostSnapshot: string;
  conversionFactorToBaseSnapshot: string;
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
    uomId: entity.uomId,
    uomCodeSnapshot: entity.uomCodeSnapshot,
    uomNameSnapshot: entity.uomNameSnapshot,
    quantity: entity.quantity,
    baseQuantitySnapshot: entity.baseQuantitySnapshot,
    unitCostSnapshot: entity.unitCostSnapshot,
    conversionFactorToBaseSnapshot: entity.conversionFactorToBaseSnapshot,
    discountSnapshot: entity.discountSnapshot,
    taxSnapshot: entity.taxSnapshot,
    lineTotal: entity.lineTotal,
    productNameSnapshot: entity.productNameSnapshot,
    skuSnapshot: entity.skuSnapshot,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}
