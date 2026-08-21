/**
 * Phase 14 locked movement-type catalog (D3/D4). Every stock-quantity
 * change anywhere in the system is represented by exactly one
 * StockMovement row carrying one of these types — the append-only internal
 * log Phase 15 will build a queryable Inventory Ledger on top of. No
 * FIFO/weighted-average/COGS semantics are attached to any of these values
 * in this phase; they are pure classification labels.
 */
export enum StockMovementType {
  PurchaseReceipt = 'PURCHASE_RECEIPT',
  SaleIssue = 'SALE_ISSUE',
  TransferIn = 'TRANSFER_IN',
  TransferOut = 'TRANSFER_OUT',
  Adjustment = 'ADJUSTMENT',
  OpeningBalance = 'OPENING_BALANCE',
  /**
   * Additive member (Returns/Discounts/Loyalty phase): a confirmed
   * SaleReturnItem with condition=RESTOCK. Only this movement type
   * increases onHandQuantity; a DAMAGED-condition item still writes a
   * traceable movement but with quantityChange=0 (see
   * SaleReturnsService.confirm()).
   */
  SaleReturn = 'SALE_RETURN',
}
