import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentDirection } from '../entities/payment-direction.enum';
import { CreatePaymentAllocationDto } from './create-payment-allocation.dto';

/** ISO-4217 3-letter currency code, matching CreateSaleDto/CreatePurchaseOrderDto's own pattern. */
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

/** Positive decimal string with up to 2 decimal places. */
const POSITIVE_DECIMAL_PATTERN = /^\d+(\.\d{1,2})?$/;

export class CreatePaymentDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsEnum(PaymentDirection)
  direction!: PaymentDirection;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsUUID()
  paymentMethodId!: string;

  @Matches(POSITIVE_DECIMAL_PATTERN, {
    message: 'amount must be a positive decimal with up to 2 decimal places',
  })
  amount!: string;

  @Matches(CURRENCY_PATTERN, {
    message: 'currency must be a 3-letter uppercase ISO-4217 code',
  })
  currency!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reference?: string;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePaymentAllocationDto)
  allocations!: CreatePaymentAllocationDto[];
}
