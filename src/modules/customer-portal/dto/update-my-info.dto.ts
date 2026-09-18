import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Deliberately narrower than customer-supplier/UpdateCustomerDto: only
 * name/phone are exposed here — a customer editing their own record via
 * the bot has no legitimate reason to touch creditLimit, paymentTermId,
 * receivableAccountId, or any other admin-only field (mass-assignment
 * discipline, docs/SECURITY_RULES.md #21).
 */
export class UpdateMyInfoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  telegramUserId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(50)
  phone?: string;
}
