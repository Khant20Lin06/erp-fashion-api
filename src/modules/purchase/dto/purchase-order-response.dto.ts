import { PurchaseOrder } from '../entities/purchase-order.entity';
import { PurchaseOrderStatus } from '../entities/purchase-order-status.enum';
import { PurchaseType } from '../entities/purchase-type.enum';
import {
  PurchaseOrderItemResponseDto,
  toPurchaseOrderItemResponseDto,
} from './purchase-order-item-response.dto';

export interface PurchaseOrderResponseDto {
  id: string;
  purchaseOrderNumber: string;
  purchaseType: PurchaseType;
  supplierId: string;
  companyId: string;
  branchId: string | null;
  warehouseId: string | null;
  paymentTermId: string | null;
  sourceSupplierQuotationId: string | null;
  transactionDate: Date;
  expectedDeliveryDate: Date | null;
  status: PurchaseOrderStatus;
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
  createdBy: string | null;
  updatedBy: string | null;
  submittedAt: Date | null;
  submittedBy: string | null;
  approvedAt: Date | null;
  approvedBy: string | null;
  rejectedAt: Date | null;
  rejectedBy: string | null;
  rejectedReason: string | null;
  closedAt: Date | null;
  closedBy: string | null;
  closeReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  itemCount: number;
  items?: PurchaseOrderItemResponseDto[];
}

export function toPurchaseOrderResponseDto(
  entity: PurchaseOrder,
): PurchaseOrderResponseDto {
  return {
    id: entity.id,
    purchaseOrderNumber: entity.purchaseOrderNumber,
    purchaseType: entity.purchaseType,
    supplierId: entity.supplierId,
    companyId: entity.companyId,
    branchId: entity.branchId,
    warehouseId: entity.warehouseId,
    paymentTermId: entity.paymentTermId,
    sourceSupplierQuotationId: entity.sourceSupplierQuotationId,
    transactionDate: entity.transactionDate,
    expectedDeliveryDate: entity.expectedDeliveryDate,
    status: entity.status,
    subtotal: entity.subtotal,
    discountAmount: entity.discountAmount,
    taxAmount: entity.taxAmount,
    grandTotal: entity.grandTotal,
    paidAmount: entity.paidAmount,
    balanceAmount: entity.balanceAmount,
    currency: entity.currency,
    notes: entity.notes,
    createdBy: entity.createdBy,
    updatedBy: entity.updatedBy,
    submittedAt: entity.submittedAt,
    submittedBy: entity.submittedBy,
    approvedAt: entity.approvedAt,
    approvedBy: entity.approvedBy,
    rejectedAt: entity.rejectedAt,
    rejectedBy: entity.rejectedBy,
    rejectedReason: entity.rejectedReason,
    closedAt: entity.closedAt,
    closedBy: entity.closedBy,
    closeReason: entity.closeReason,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    itemCount: entity.itemCount ?? entity.items?.length ?? 0,
    items: entity.items
      ? entity.items.map(toPurchaseOrderItemResponseDto)
      : undefined,
  };
}
