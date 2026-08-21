/**
 * D2 (LOCKED): a single Payment table supports these directions.
 * RECEIPT = customer pays the company (against a Sale).
 * PAYMENT = the company pays a supplier (against a PurchaseOrder).
 * REFUND (additive, Returns/Discounts/Loyalty phase) = the company pays
 * money back to a customer (against a confirmed SaleReturn) — the exact
 * reverse cash flow of RECEIPT, kept as its own direction rather than
 * overloading RECEIPT with a negative amount (this codebase never uses
 * signed amounts on Payment; every amount column is a plain positive
 * decimal, matching StockMovement.quantityChange being the one deliberate
 * signed-value exception elsewhere).
 */
export enum PaymentDirection {
  Receipt = 'RECEIPT',
  Payment = 'PAYMENT',
  Refund = 'REFUND',
}
