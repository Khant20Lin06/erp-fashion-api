import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { ProductVariantUomUsageType } from '../entities/product-variant-uom-usage-type.enum';

const POSITIVE_FACTOR_PATTERN = /^(?!0+(?:\.0+)?$)\d+(\.\d{1,4})?$/;

export class CreateProductVariantUomDto {
  @IsUUID()
  uomId!: string;

  @Matches(POSITIVE_FACTOR_PATTERN, {
    message: 'conversionFactorToBase must be a positive decimal string',
  })
  conversionFactorToBase!: string;

  @IsEnum(ProductVariantUomUsageType)
  usageType!: ProductVariantUomUsageType;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  barcode?: string;
}
