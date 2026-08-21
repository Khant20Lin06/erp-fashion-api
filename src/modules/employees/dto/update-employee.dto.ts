import {
  IsEmail,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * `companyId`/`branchId` are deliberately absent — immutable after creation,
 * matching the same pattern used for Company/Branch/Warehouse (Phase 07
 * §64). A real transfer would be a dedicated future operation, not a PATCH.
 */
export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  emergencyContactName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  emergencyContactPhone?: string | null;
}
