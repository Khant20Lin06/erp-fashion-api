import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Payment } from '../entities/payment.entity';
import { PaymentDirection } from '../entities/payment-direction.enum';
import { PaymentStatus } from '../entities/payment-status.enum';
import {
  PaymentAllocationResponseDto,
  toPaymentAllocationResponseDto,
} from './payment-allocation-response.dto';

export class PaymentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'PAY-000001' })
  paymentNumber!: string;

  @ApiProperty({ format: 'uuid' })
  companyId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  branchId!: string | null;

  @ApiProperty({ enum: PaymentDirection, example: PaymentDirection.Receipt })
  direction!: PaymentDirection;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  customerId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  supplierId!: string | null;

  @ApiProperty({ format: 'uuid' })
  paymentMethodId!: string;

  @ApiProperty({ example: '250.00' })
  amount!: string;

  @ApiProperty({ example: 'USD' })
  currency!: string;

  @ApiPropertyOptional({ example: 'RCPT-001', nullable: true })
  reference!: string | null;

  @ApiPropertyOptional({
    example: 'payment-create-001',
    nullable: true,
    description: 'Echoed idempotency key if one was supplied.',
  })
  idempotencyKey!: string | null;

  @ApiProperty({ enum: PaymentStatus, example: PaymentStatus.Confirmed })
  status!: PaymentStatus;

  @ApiProperty({ example: '2026-08-15T00:00:00.000Z' })
  paymentDate!: Date;

  @ApiPropertyOptional({ example: 'Customer settlement', nullable: true })
  notes!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  createdBy!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  updatedBy!: string | null;

  @ApiProperty({ example: '2026-08-15T09:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-08-15T09:00:00.000Z' })
  updatedAt!: Date;

  @ApiPropertyOptional({ type: [PaymentAllocationResponseDto] })
  allocations?: PaymentAllocationResponseDto[];
}

export class PaymentListResponseDto {
  @ApiProperty({ type: [PaymentResponseDto] })
  data!: PaymentResponseDto[];

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Pagination metadata returned by the existing list endpoint.',
  })
  meta!: unknown;
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
