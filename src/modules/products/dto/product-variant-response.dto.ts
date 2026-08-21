import { ProductVariant } from '../entities/product-variant.entity';
import { ProductVariantStatus } from '../entities/product-variant-status.enum';
import { AttributeKind } from '../../master-data/entities/attribute-kind.enum';

export interface VariantAttributeResponseDto {
  kind: AttributeKind;
  optionId: string;
  optionCode?: string;
  optionValue?: string;
  swatch?: string | null;
}

export interface ProductVariantResponseDto {
  id: string;
  productId: string;
  companyId: string;
  sku: string;
  costPrice: string;
  sellingPrice: string;
  status: ProductVariantStatus;
  attributes: VariantAttributeResponseDto[];
  createdAt: Date;
  updatedAt: Date;
}

export function toProductVariantResponseDto(
  variant: ProductVariant,
  attributes: VariantAttributeResponseDto[] = [],
): ProductVariantResponseDto {
  return {
    id: variant.id,
    productId: variant.productId,
    companyId: variant.companyId,
    sku: variant.sku,
    costPrice: variant.costPrice,
    sellingPrice: variant.sellingPrice,
    status: variant.status,
    attributes,
    createdAt: variant.createdAt,
    updatedAt: variant.updatedAt,
  };
}
