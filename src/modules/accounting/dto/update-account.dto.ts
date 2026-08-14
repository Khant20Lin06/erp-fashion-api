import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * `code`/`accountType` are deliberately absent — immutable after creation,
 * matching the convention already used for Category/Brand/etc. codes
 * (Phase 09). `parentId` is editable (re-parenting), cycle-checked exactly
 * like Category. `isActive` is the only lifecycle field — no delete
 * endpoint exists (D4: "prefer deactivation").
 */
export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
