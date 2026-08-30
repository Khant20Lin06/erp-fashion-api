import { ProductVariantUom } from '../entities/product-variant-uom.entity';
import { ProductVariantUomUsageType } from '../entities/product-variant-uom-usage-type.enum';

export interface ProductVariantUomResponseDto {
  id: string;
  variantId: string;
  companyId: string;
  uomId: string;
  uomCode: string | null;
  uomName: string | null;
  conversionFactorToBase: string;
  usageType: ProductVariantUomUsageType;
  barcode: string | null;
  isBase: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toProductVariantUomResponseDto(
  mapping: ProductVariantUom,
): ProductVariantUomResponseDto {
  return {
    id: mapping.id,
    variantId: mapping.variantId,
    companyId: mapping.companyId,
    uomId: mapping.uomId,
    uomCode: mapping.uom?.code ?? null,
    uomName: mapping.uom?.name ?? null,
    conversionFactorToBase: mapping.conversionFactorToBase,
    usageType: mapping.usageType,
    barcode: mapping.barcode,
    isBase: mapping.isBase,
    isActive: mapping.isActive,
    createdAt: mapping.createdAt,
    updatedAt: mapping.updatedAt,
  };
}
