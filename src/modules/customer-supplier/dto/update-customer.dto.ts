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

/** Non-negative decimal with up to 2 fraction digits (Phase 11 §11: creditLimit >= 0). */
const NON_NEGATIVE_DECIMAL_PATTERN = /^\d+(\.\d{1,2})?$/;

/** `customerCode`/`companyId`/`branchId` are deliberately absent — immutable after creation. */
export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

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
  customerGroupId?: string;

  @IsOptional()
  @IsUUID()
  paymentTermId?: string;

  @IsOptional()
  @Matches(NON_NEGATIVE_DECIMAL_PATTERN, {
    message:
      'creditLimit must be a non-negative decimal string, e.g. "1000.00"',
  })
  creditLimit?: string;

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
  receivableAccountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
