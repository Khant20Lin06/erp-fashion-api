/**
 * Determines where a confirmed return's stock effect goes. RESTOCK
 * increases WarehouseStock.onHandQuantity (item is sellable again).
 * DAMAGED writes a traceable StockMovement documenting the return but does
 * NOT increase onHandQuantity — matching the existing
 * StockAdjustmentReason.Damage precedent (a reason label, not a separate
 * non-sellable quantity bucket, since WarehouseStock has no
 * damagedQuantity/quarantineQuantity column anywhere in this codebase).
 */
export enum SaleReturnItemCondition {
  Restock = 'RESTOCK',
  Damaged = 'DAMAGED',
}
