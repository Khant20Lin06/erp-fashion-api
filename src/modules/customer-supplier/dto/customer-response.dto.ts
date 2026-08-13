import { Customer } from '../entities/customer.entity';
import { CustomerStatus } from '../entities/customer-status.enum';

export interface CustomerResponseDto {
  id: string;
  companyId: string;
  branchId: string | null;
  customerCode: string;
  name: string;
  displayName: string | null;
  phone: string | null;
  email: string | null;
  customerGroupId: string | null;
  paymentTermId: string | null;
  creditLimit: string;
  creditDays: number;
  /** Initial master-data value only — NOT a live/current balance. See docs/CUSTOMER_SUPPLIER_ARCHITECTURE.md. */
  openingBalanceAmount: string;
  /** Inert Phase 17 placeholder — no FK exists yet. */
  receivableAccountId: string | null;
  status: CustomerStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toCustomerResponseDto(entity: Customer): CustomerResponseDto {
  return {
    id: entity.id,
    companyId: entity.companyId,
    branchId: entity.branchId,
    customerCode: entity.customerCode,
    name: entity.name,
    displayName: entity.displayName,
    phone: entity.phone,
    email: entity.email,
    customerGroupId: entity.customerGroupId,
    paymentTermId: entity.paymentTermId,
    creditLimit: entity.creditLimit,
    creditDays: entity.creditDays,
    openingBalanceAmount: entity.openingBalanceAmount,
    receivableAccountId: entity.receivableAccountId,
    status: entity.status,
    notes: entity.notes,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}
