import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { UomCategory } from '../entities/uom-category.enum';

export class CreateUomDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const normalized = value.trim().toUpperCase();
    return normalized === '' ? undefined : normalized;
  })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  @Matches(/^[A-Z0-9_-]+$/, {
    message: 'code must contain only uppercase letters, numbers, - and _',
  })
  code!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(20)
  symbol?: string;

  @IsEnum(UomCategory)
  category!: UomCategory;

  @IsInt()
  @Min(0)
  @Max(6)
  decimalPlaces!: number;
}
