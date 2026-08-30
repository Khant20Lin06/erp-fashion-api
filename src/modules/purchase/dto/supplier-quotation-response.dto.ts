import { SupplierQuotation } from '../entities/supplier-quotation.entity';
import { SupplierQuotationStatus } from '../entities/supplier-quotation-status.enum';
import {
  SupplierQuotationItemResponseDto,
  toSupplierQuotationItemResponseDto,
} from './supplier-quotation-item-response.dto';

export interface SupplierQuotationRfqSummaryDto {
  id: string;
  rfqNumber: string;
  title: string;
  requiredDate: Date;
  purchaseRequestId: string | null;
}

export interface SupplierQuotationResponseDto {
  id: string;
  quotationNumber: string;
  companyId: string;
  purchaseRfqId: string;
  supplierId: string;
  paymentTermId: string | null;
  leadTimeDays: number | null;
  status: SupplierQuotationStatus;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  grandTotal: string;
  currency: string;
  notes: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  itemCount: number;
  purchaseRfq?: SupplierQuotationRfqSummaryDto;
  items?: SupplierQuotationItemResponseDto[];
}

export function toSupplierQuotationResponseDto(
  entity: SupplierQuotation,
): SupplierQuotationResponseDto {
  return {
    id: entity.id,
    quotationNumber: entity.quotationNumber,
    companyId: entity.companyId,
    purchaseRfqId: entity.purchaseRfqId,
    supplierId: entity.supplierId,
    paymentTermId: entity.paymentTermId,
    leadTimeDays: entity.leadTimeDays,
    status: entity.status,
    subtotal: entity.subtotal,
    discountAmount: entity.discountAmount,
    taxAmount: entity.taxAmount,
    grandTotal: entity.grandTotal,
    currency: entity.currency,
    notes: entity.notes,
    createdBy: entity.createdBy,
    updatedBy: entity.updatedBy,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    itemCount: entity.items?.length ?? 0,
    purchaseRfq: entity.purchaseRfq
      ? {
          id: entity.purchaseRfq.id,
          rfqNumber: entity.purchaseRfq.rfqNumber,
          title: entity.purchaseRfq.title,
          requiredDate: entity.purchaseRfq.requiredDate,
          purchaseRequestId: entity.purchaseRfq.purchaseRequestId,
        }
      : undefined,
    items: entity.items
      ? entity.items.map(toSupplierQuotationItemResponseDto)
      : undefined,
  };
}
