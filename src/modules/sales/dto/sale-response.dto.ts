import { Sale } from '../entities/sale.entity';
import { SaleStatus } from '../entities/sale-status.enum';
import { SaleType } from '../entities/sale-type.enum';
import { SaleFulfillmentStatus } from '../entities/sale-fulfillment-status.enum';
import {
  SaleItemResponseDto,
  toSaleItemResponseDto,
} from './sale-item-response.dto';

export interface SaleResponseDto {
  id: string;
  saleNumber: string;
  saleType: SaleType;
  customerId: string;
  salesAccountId: string | null;
  companyId: string;
  branchId: string | null;
  warehouseId: string | null;
  transactionDate: Date;
  status: SaleStatus;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  grandTotal: string;
  /** Inert Phase 16 (Payment) integration field. */
  paidAmount: string;
  /** Inert Phase 16 (Payment) integration field. */
  balanceAmount: string;
  currency: string;
  notes: string | null;
  fulfillmentStatus: SaleFulfillmentStatus | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  items?: SaleItemResponseDto[];
}

export function toSaleResponseDto(entity: Sale): SaleResponseDto {
  return {
    id: entity.id,
    saleNumber: entity.saleNumber,
    saleType: entity.saleType,
    customerId: entity.customerId,
    salesAccountId: entity.salesAccountId,
    companyId: entity.companyId,
    branchId: entity.branchId,
    warehouseId: entity.warehouseId,
    transactionDate: entity.transactionDate,
    status: entity.status,
    subtotal: entity.subtotal,
    discountAmount: entity.discountAmount,
    taxAmount: entity.taxAmount,
    grandTotal: entity.grandTotal,
    paidAmount: entity.paidAmount,
    balanceAmount: entity.balanceAmount,
    currency: entity.currency,
    notes: entity.notes,
    fulfillmentStatus: entity.fulfillmentStatus,
    shippedAt: entity.shippedAt,
    deliveredAt: entity.deliveredAt,
    createdBy: entity.createdBy,
    updatedBy: entity.updatedBy,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    items: entity.items ? entity.items.map(toSaleItemResponseDto) : undefined,
  };
}
