import { PaymentTerm } from '../entities/payment-term.entity';
import { PaymentTermStatus } from '../entities/payment-term-status.enum';

export interface PaymentTermResponseDto {
  id: string;
  companyId: string;
  code: string;
  name: string;
  description: string | null;
  dueDays: number;
  status: PaymentTermStatus;
  createdAt: Date;
  updatedAt: Date;
}

export function toPaymentTermResponseDto(
  entity: PaymentTerm,
): PaymentTermResponseDto {
  return {
    id: entity.id,
    companyId: entity.companyId,
    code: entity.code,
    name: entity.name,
    description: entity.description,
    dueDays: entity.dueDays,
    status: entity.status,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}
