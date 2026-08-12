import { Type } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ProductType } from '../entities/product-type.enum';
import { CreateProductVariantDto } from './create-product-variant.dto';

export class CreateProductDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @Matches(/^[A-Z0-9_-]+$/, {
    message: 'code must contain only uppercase letters, numbers, - and _',
  })
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsUUID()
  categoryId!: string;

  @IsUUID()
  brandId!: string;

  @IsOptional()
  @IsUUID()
  collectionId?: string;

  @IsOptional()
  @IsEnum(ProductType)
  productType?: ProductType;

  /** Every Product is created with exactly one initial ProductVariant, transactionally (Phase 10 D8). */
  @ValidateNested()
  @Type(() => CreateProductVariantDto)
  initialVariant!: CreateProductVariantDto;
}
