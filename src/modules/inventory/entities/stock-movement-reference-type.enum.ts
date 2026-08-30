/**
 * Polymorphic discriminator for StockMovement.referenceId — identifies
 * which table referenceId points into. No FK constraint is possible on a
 * polymorphic column (Phase 14 locked decision D4), so this enum is the
 * only structural guarantee of which table a given movement traces back to.
 */
export enum StockMovementReferenceType {
  GoodsReceipt = 'GOODS_RECEIPT',
  Sale = 'SALE',
  StockTransfer = 'STOCK_TRANSFER',
  StockAdjustment = 'STOCK_ADJUSTMENT',
  /** Additive member (Returns/Discounts/Loyalty phase): points at SaleReturn.id. */
  SaleReturn = 'SALE_RETURN',
  PurchaseReturn = 'PURCHASE_RETURN',
}
