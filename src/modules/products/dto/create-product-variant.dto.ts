import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { VariantAttributeInputDto } from './variant-attribute-input.dto';

/** Used both standalone (POST /products/:id/variants) and nested inside CreateProductDto's initial variant. */
export class CreateProductVariantDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  sku!: string;

  @IsNumberString()
  costPrice!: string;

  @IsNumberString()
  sellingPrice!: string;

  @IsOptional()
  @IsUUID()
  baseUomId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => VariantAttributeInputDto)
  attributes?: VariantAttributeInputDto[];
}
