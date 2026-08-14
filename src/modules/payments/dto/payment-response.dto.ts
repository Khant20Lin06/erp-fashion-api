import { Payment } from '../entities/payment.entity';
import { PaymentDirection } from '../entities/payment-direction.enum';
import { PaymentStatus } from '../entities/payment-status.enum';
import {
  PaymentAllocationResponseDto,
  toPaymentAllocationResponseDto,
} from './payment-allocation-response.dto';

export interface PaymentResponseDto {
  id: string;
  paymentNumber: string;
  companyId: string;
  branchId: string | null;
  direction: PaymentDirection;
  customerId: string | null;
  supplierId: string | null;
  paymentMethodId: string;
  amount: string;
  currency: string;
  reference: string | null;
  idempotencyKey: string | null;
  status: PaymentStatus;
  paymentDate: Date;
  notes: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  allocations?: PaymentAllocationResponseDto[];
}

export function toPaymentResponseDto(entity: Payment): PaymentResponseDto {
  return {
    id: entity.id,
    paymentNumber: entity.paymentNumber,
    companyId: entity.companyId,
    branchId: entity.branchId,
    direction: entity.direction,
    customerId: entity.customerId,
    supplierId: entity.supplierId,
    paymentMethodId: entity.paymentMethodId,
    amount: entity.amount,
    currency: entity.currency,
    reference: entity.reference,
    idempotencyKey: entity.idempotencyKey,
    status: entity.status,
    paymentDate: entity.paymentDate,
    notes: entity.notes,
    createdBy: entity.createdBy,
    updatedBy: entity.updatedBy,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    allocations: entity.allocations
      ? entity.allocations.map(toPaymentAllocationResponseDto)
      : undefined,
  };
}
