/**
 * D3 (LOCKED): polymorphic referenceType/referenceId pair on
 * PaymentAllocation, mirroring StockMovement.referenceType/referenceId's
 * established precedent (Phase 14) exactly — no separate
 * SalePaymentAllocation/PurchasePaymentAllocation tables.
 */
export enum PaymentReferenceType {
  Sale = 'SALE',
  PurchaseOrder = 'PURCHASE_ORDER',
  /** Additive member: a REFUND payment allocates against a confirmed SaleReturn. */
  SaleReturn = 'SALE_RETURN',
}
