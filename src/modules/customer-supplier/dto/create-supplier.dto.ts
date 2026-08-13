import {
  IsEmail,
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

/** Non-negative decimal with up to 2 fraction digits (Phase 11 §11: >= 0). */
const NON_NEGATIVE_DECIMAL_PATTERN = /^\d+(\.\d{1,2})?$/;

export class CreateSupplierDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @Matches(/^[A-Z0-9_-]+$/, {
    message:
      'supplierCode must contain only uppercase letters, numbers, - and _',
  })
  supplierCode!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

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
  @IsUUID()
  supplierGroupId?: string;

  @IsOptional()
  @IsUUID()
  paymentTermId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3650)
  creditDays?: number;

  @IsOptional()
  @Matches(NON_NEGATIVE_DECIMAL_PATTERN, {
    message:
      'openingBalanceAmount must be a non-negative decimal string, e.g. "0.00"',
  })
  openingBalanceAmount?: string;

  @IsOptional()
  @IsUUID()
  payableAccountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
