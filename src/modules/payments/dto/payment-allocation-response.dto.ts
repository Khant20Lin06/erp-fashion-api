import { PaymentAllocation } from '../entities/payment-allocation.entity';
import { PaymentReferenceType } from '../entities/payment-reference-type.enum';

export interface PaymentAllocationResponseDto {
  id: string;
  paymentId: string;
  referenceType: PaymentReferenceType;
  referenceId: string;
  allocatedAmount: string;
  createdAt: Date;
}

export function toPaymentAllocationResponseDto(
  entity: PaymentAllocation,
): PaymentAllocationResponseDto {
  return {
    id: entity.id,
    paymentId: entity.paymentId,
    referenceType: entity.referenceType,
    referenceId: entity.referenceId,
    allocatedAmount: entity.allocatedAmount,
    createdAt: entity.createdAt,
  };
}
