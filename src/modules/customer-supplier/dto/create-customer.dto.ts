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

/** Non-negative decimal with up to 2 fraction digits, e.g. "0", "1000", "1000.00", "1000.5". Rejects negative values (Phase 11 §11: creditLimit >= 0). */
const NON_NEGATIVE_DECIMAL_PATTERN = /^\d+(\.\d{1,2})?$/;

export class CreateCustomerDto {
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
      'customerCode must contain only uppercase letters, numbers, - and _',
  })
  customerCode!: string;

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
