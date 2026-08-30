import { PurchaseInvoiceStatus } from '../entities/purchase-invoice-status.enum';

export interface PurchaseInvoiceResponseDto {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  purchaseOrderId: string;
  goodsReceiptIds: string[];
  companyId: string;
  invoiceDate: Date;
  dueDate: Date;
  status: PurchaseInvoiceStatus;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  grandTotal: string;
  amountPaid: string;
  creditedAmount: string;
  balanceAmount: string;
  currency: string;
  paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE';
  postedAt: Date | null;
  postedBy: string | null;
  voidedAt: Date | null;
  voidedBy: string | null;
  voidReason: string | null;
}
