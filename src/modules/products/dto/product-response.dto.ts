import { Product } from '../entities/product.entity';
import { ProductStatus } from '../entities/product-status.enum';
import { ProductType } from '../entities/product-type.enum';

export interface ProductResponseDto {
  id: string;
  companyId: string;
  code: string;
  name: string;
  description: string | null;
  categoryId: string;
  brandId: string;
  collectionId: string | null;
  productType: ProductType;
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date;
}

export function toProductResponseDto(product: Product): ProductResponseDto {
  return {
    id: product.id,
    companyId: product.companyId,
    code: product.code,
    name: product.name,
    description: product.description,
    categoryId: product.categoryId,
    brandId: product.brandId,
    collectionId: product.collectionId,
    productType: product.productType,
    status: product.status,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}
