/**
 * D3 (LOCKED): polymorphic referenceType/referenceId pair on
 * PaymentAllocation, mirroring StockMovement.referenceType/referenceId's
 * established precedent (Phase 14) exactly — no separate
 * SalePaymentAllocation/PurchasePaymentAllocation tables.
 */
export enum PaymentReferenceType {
  Sale = 'SALE',
  PurchaseOrder = 'PURCHASE_ORDER',
}
