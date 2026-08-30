import { SaleItem } from '../entities/sale-item.entity';

export interface SaleItemResponseDto {
  id: string;
  saleId: string;
  productVariantId: string;
  uomId: string | null;
  uomCodeSnapshot: string | null;
  uomNameSnapshot: string | null;
  quantity: number;
  baseQuantitySnapshot: number;
  conversionFactorToBaseSnapshot: string;
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
    uomId: entity.uomId,
    uomCodeSnapshot: entity.uomCodeSnapshot,
    uomNameSnapshot: entity.uomNameSnapshot,
    quantity: entity.quantity,
    baseQuantitySnapshot: entity.baseQuantitySnapshot,
    conversionFactorToBaseSnapshot: entity.conversionFactorToBaseSnapshot,
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
