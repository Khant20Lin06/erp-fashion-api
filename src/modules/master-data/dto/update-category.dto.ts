import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * `code` is deliberately absent — immutable after creation, matching the
 * convention already used for Company/Branch/Warehouse/Employee/
 * SalesAccount/Brand codes (Phase 09 §2, LOCKED: "immutable unless the
 * specification explicitly permits editing" — it does not).
 */
export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
