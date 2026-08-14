import { IsEnum, IsUUID, Matches } from 'class-validator';
import { PaymentReferenceType } from '../entities/payment-reference-type.enum';

/** Non-negative decimal string, matching Customer.creditLimit's own DTO-layer pattern (Phase 11). */
const DECIMAL_PATTERN = /^\d+(\.\d{1,2})?$/;

export class CreatePaymentAllocationDto {
  @IsEnum(PaymentReferenceType)
  referenceType!: PaymentReferenceType;

  @IsUUID()
  referenceId!: string;

  @Matches(DECIMAL_PATTERN, {
    message:
      'allocatedAmount must be a non-negative decimal with up to 2 decimal places',
  })
  allocatedAmount!: string;
}
