import { ApiProperty } from '@nestjs/swagger';
import { PaymentAllocation } from '../entities/payment-allocation.entity';
import { PaymentReferenceType } from '../entities/payment-reference-type.enum';

export class PaymentAllocationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  paymentId!: string;

  @ApiProperty({
    enum: PaymentReferenceType,
    example: PaymentReferenceType.Sale,
  })
  referenceType!: PaymentReferenceType;

  @ApiProperty({ format: 'uuid' })
  referenceId!: string;

  @ApiProperty({ example: '250.00' })
  allocatedAmount!: string;

  @ApiProperty({ example: '2026-08-15T09:00:00.000Z' })
  createdAt!: Date;
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
