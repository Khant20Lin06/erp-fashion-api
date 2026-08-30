import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ProductVariantUomUsageType } from '../entities/product-variant-uom-usage-type.enum';

const POSITIVE_FACTOR_PATTERN = /^(?!0+(?:\.0+)?$)\d+(\.\d{1,4})?$/;

export class UpdateProductVariantUomDto {
  @IsOptional()
  @Matches(POSITIVE_FACTOR_PATTERN, {
    message: 'conversionFactorToBase must be a positive decimal string',
  })
  conversionFactorToBase?: string;

  @IsOptional()
  @IsEnum(ProductVariantUomUsageType)
  usageType?: ProductVariantUomUsageType;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  barcode?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
