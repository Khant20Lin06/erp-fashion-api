/**
 * Polymorphic referenceType/referenceId pair on JournalEntryLine — mirrors
 * PaymentAllocation.referenceType/StockMovement.referenceType's established
 * precedent (Phase 14/16) exactly. A Payment-sourced journal's two lines
 * both carry referenceType=PAYMENT/referenceId=payment.id (in addition to
 * the JournalEntry header's own sourceType/sourceId) so a line can always
 * be traced back to its originating document without a join through the
 * header when querying lines directly (General Ledger's own query shape).
 */
export enum JournalReferenceType {
  Payment = 'PAYMENT',
  Sale = 'SALE',
  PurchaseOrder = 'PURCHASE_ORDER',
}
