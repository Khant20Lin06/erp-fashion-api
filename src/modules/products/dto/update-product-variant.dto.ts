import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNumberString,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { VariantAttributeInputDto } from './variant-attribute-input.dto';

/** `sku` is deliberately absent — restricted after creation (Phase 10 §13). */
export class UpdateProductVariantDto {
  @IsOptional()
  @IsNumberString()
  costPrice?: string;

  @IsOptional()
  @IsNumberString()
  sellingPrice?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => VariantAttributeInputDto)
  attributes?: VariantAttributeInputDto[];
}
