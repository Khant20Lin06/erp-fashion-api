import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { UomCategory } from '../entities/uom-category.enum';

export class UpdateUomDto {
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const normalized = value.trim().toUpperCase();
    return normalized === '' ? undefined : normalized;
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  @Matches(/^[A-Z0-9_-]+$/, {
    message: 'code must contain only uppercase letters, numbers, - and _',
  })
  code?: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(20)
  symbol?: string | null;

  @IsOptional()
  @IsEnum(UomCategory)
  category?: UomCategory;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  decimalPlaces?: number;
}
