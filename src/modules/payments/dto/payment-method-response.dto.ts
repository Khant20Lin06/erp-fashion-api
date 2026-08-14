import { PaymentMethod } from '../entities/payment-method.entity';
import { PaymentMethodStatus } from '../entities/payment-method-status.enum';

export interface PaymentMethodResponseDto {
  id: string;
  companyId: string;
  code: string;
  name: string;
  status: PaymentMethodStatus;
  createdAt: Date;
  updatedAt: Date;
}

export function toPaymentMethodResponseDto(
  entity: PaymentMethod,
): PaymentMethodResponseDto {
  return {
    id: entity.id,
    companyId: entity.companyId,
    code: entity.code,
    name: entity.name,
    status: entity.status,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}
