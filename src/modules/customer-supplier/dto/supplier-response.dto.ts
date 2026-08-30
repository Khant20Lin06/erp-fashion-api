import { Supplier } from '../entities/supplier.entity';
import { SupplierStatus } from '../entities/supplier-status.enum';

export interface SupplierResponseDto {
  id: string;
  companyId: string;
  branchId: string | null;
  supplierCode: string;
  name: string;
  displayName: string | null;
  phone: string | null;
  email: string | null;
  country: string | null;
  supplierGroupId: string | null;
  paymentTermId: string | null;
  creditDays: number;
  /** Initial master-data value only — NOT a live/current balance. See docs/CUSTOMER_SUPPLIER_ARCHITECTURE.md. */
  openingBalanceAmount: string;
  /** Inert Phase 17 placeholder — no FK exists yet. */
  payableAccountId: string | null;
  status: SupplierStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toSupplierResponseDto(entity: Supplier): SupplierResponseDto {
  return {
    id: entity.id,
    companyId: entity.companyId,
    branchId: entity.branchId,
    supplierCode: entity.supplierCode,
    name: entity.name,
    displayName: entity.displayName,
    phone: entity.phone,
    email: entity.email,
    country: entity.country,
    supplierGroupId: entity.supplierGroupId,
    paymentTermId: entity.paymentTermId,
    creditDays: entity.creditDays,
    openingBalanceAmount: entity.openingBalanceAmount,
    payableAccountId: entity.payableAccountId,
    status: entity.status,
    notes: entity.notes,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}
