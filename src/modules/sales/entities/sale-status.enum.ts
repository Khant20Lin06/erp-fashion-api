/**
 * Phase 12 locked lifecycle (locked decision §E) — deliberately three
 * states only, no PENDING_APPROVAL/PARTIALLY_PAID/PAID/COMPLETED. Payment
 * status is an inert integration field (Sale.paidAmount/balanceAmount) for
 * Phase 16, not a status value here; approval workflow is explicitly out of
 * scope for Phase 12. See docs/SALES_ARCHITECTURE.md "Lifecycle".
 */
export enum SaleStatus {
  Draft = 'DRAFT',
  Confirmed = 'CONFIRMED',
  Cancelled = 'CANCELLED',
}
