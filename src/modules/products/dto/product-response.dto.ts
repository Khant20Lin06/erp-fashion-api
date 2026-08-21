import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Product } from '../entities/product.entity';
import { ProductStatus } from '../entities/product-status.enum';
import { ProductType } from '../entities/product-type.enum';

export class ProductResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  companyId!: string;

  @ApiProperty({ example: 'TSHIRT-001' })
  code!: string;

  @ApiProperty({ example: 'Basic T-Shirt' })
  name!: string;

  @ApiPropertyOptional({
    example: '100% cotton crew neck tee',
    nullable: true,
  })
  description!: string | null;

  @ApiProperty({ format: 'uuid' })
  categoryId!: string;

  @ApiProperty({ format: 'uuid' })
  brandId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  collectionId!: string | null;

  @ApiProperty({ enum: ProductType, example: ProductType.Simple })
  productType!: ProductType;

  @ApiProperty({ enum: ProductStatus, example: ProductStatus.Active })
  status!: ProductStatus;

  @ApiProperty({ example: '2026-08-15T09:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-08-15T09:00:00.000Z' })
  updatedAt!: Date;
}

export class ProductListResponseDto {
  @ApiProperty({ type: [ProductResponseDto] })
  data!: ProductResponseDto[];

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Pagination metadata returned by the existing list endpoint.',
  })
  meta!: unknown;
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
