import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** `kind` and `code` are deliberately absent — immutable after creation. */
export class UpdateAttributeOptionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  value?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const normalized = value.trim().toUpperCase();
    return normalized === '' ? undefined : normalized;
  })
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'swatch must be a 6-digit hex color (e.g. #1A2B3C)',
  })
  swatch?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
