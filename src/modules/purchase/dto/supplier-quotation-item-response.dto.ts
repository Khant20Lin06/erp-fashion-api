import { SupplierQuotationItem } from '../entities/supplier-quotation-item.entity';

export interface SupplierQuotationItemResponseDto {
  id: string;
  supplierQuotationId: string;
  purchaseRfqItemId: string;
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

export function toSupplierQuotationItemResponseDto(
  entity: SupplierQuotationItem,
): SupplierQuotationItemResponseDto {
  return {
    id: entity.id,
    supplierQuotationId: entity.supplierQuotationId,
    purchaseRfqItemId: entity.purchaseRfqItemId,
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
