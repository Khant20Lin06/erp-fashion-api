import { SaleItem } from '../entities/sale-item.entity';

export interface SaleItemResponseDto {
  id: string;
  saleId: string;
  productVariantId: string;
  quantity: number;
  unitPriceSnapshot: string;
  discountSnapshot: string;
  taxSnapshot: string;
  lineTotal: string;
  productNameSnapshot: string;
  skuSnapshot: string;
  createdAt: Date;
  updatedAt: Date;
}

export function toSaleItemResponseDto(entity: SaleItem): SaleItemResponseDto {
  return {
    id: entity.id,
    saleId: entity.saleId,
    productVariantId: entity.productVariantId,
    quantity: entity.quantity,
    unitPriceSnapshot: entity.unitPriceSnapshot,
    discountSnapshot: entity.discountSnapshot,
    taxSnapshot: entity.taxSnapshot,
    lineTotal: entity.lineTotal,
    productNameSnapshot: entity.productNameSnapshot,
    skuSnapshot: entity.skuSnapshot,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}
