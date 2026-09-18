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
  color?: string | null;
  size?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toSaleItemResponseDto(entity: SaleItem): SaleItemResponseDto {
  let color: string | null = null;
  let size: string | null = null;

  if (entity.productVariant?.attributes) {
    for (const attr of entity.productVariant.attributes) {
      const kind = String(attr.kind || '').toUpperCase();
      if (kind === 'COLOR' && attr.option?.value) {
        color = attr.option.value;
      } else if (kind === 'SIZE' && attr.option?.value) {
        size = attr.option.value;
      }
    }
  }

  // Fallback: parse color and size from skuSnapshot (e.g. PROD-BULK-002-GRE-XS)
  if (!color || !size) {
    const skuParts = (entity.skuSnapshot || '').split('-');
    if (skuParts.length >= 2) {
      const last = skuParts[skuParts.length - 1];
      const secondLast = skuParts[skuParts.length - 2];
      const knownSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', 'FREE'];
      if (!size && knownSizes.includes(last.toUpperCase())) {
        size = last.toUpperCase();
        if (!color && secondLast && secondLast.length <= 5) {
          color = secondLast;
        }
      }
    }
  }

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
    color,
    size,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}
