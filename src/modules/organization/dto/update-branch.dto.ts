import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * `companyId` and `code` are deliberately absent — companyId is immutable
 * after creation (Phase 07 §64) and code uniqueness is scoped to companyId,
 * so neither is exposed for update through this DTO.
 */
export class UpdateBranchDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;
}
