/**
 * Phase 13 locked lifecycle (mirrors Sale's Phase 12 §E locked decision) —
 * deliberately three states only, no PENDING_APPROVAL/PARTIALLY_RECEIVED/
 * RECEIVED/CLOSED. Receiving status is Phase 14's (Goods Receipt) concern,
 * not a PurchaseOrder status value here; approval workflow is explicitly
 * out of scope for Phase 13. See docs/PURCHASE_ARCHITECTURE.md "Lifecycle".
 */
export enum PurchaseOrderStatus {
  Draft = 'DRAFT',
  Submitted = 'SUBMITTED',
  Approved = 'APPROVED',
  Confirmed = 'CONFIRMED',
  Rejected = 'REJECTED',
  Closed = 'CLOSED',
  Cancelled = 'CANCELLED',
}
