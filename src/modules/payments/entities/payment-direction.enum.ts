/**
 * D2 (LOCKED): a single Payment table supports both directions.
 * RECEIPT = customer pays the company (against a Sale).
 * PAYMENT = the company pays a supplier (against a PurchaseOrder).
 */
export enum PaymentDirection {
  Receipt = 'RECEIPT',
  Payment = 'PAYMENT',
}
