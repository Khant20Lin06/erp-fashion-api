import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AttributeKind } from '../entities/attribute-kind.enum';

export class CreateAttributeOptionDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsEnum(AttributeKind)
  kind!: AttributeKind;

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
  value!: string;

  /** Only meaningful for kind=COLOR — validated in the service layer, not the DB. */
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
