/**
 * D4 (LOCKED, implementation-detail judgment call — see
 * docs/PAYMENT_ARCHITECTURE.md "Lifecycle Decision"): every Payment is
 * created directly as CONFIRMED (allocation happens inside the same
 * POST /payments transaction, so a separate DRAFT stage would be an inert
 * intermediate state with no distinct behavior — no endpoint anywhere
 * creates a Payment without immediately allocating it). CANCELLED is the
 * only other reachable state, via a dedicated POST /payments/:id/cancel-
 * style endpoint — actually NOT built either, since D5/D10 forbid any
 * reversal of a confirmed payment's financial effect and a CANCELLED
 * payment would need exactly that (reversing paidAmount/balanceAmount).
 * CONFIRMED is therefore the only value this enum's CONFIRMED member is
 * ever assigned in practice; CANCELLED is retained on the enum only to
 * keep the shape symmetric with Sale/PurchaseOrder's own status enums
 * and to leave room for a future phase to add real cancellation semantics
 * without a schema change. See docs/PAYMENT_ARCHITECTURE.md for the full
 * reasoning.
 */
export enum PaymentStatus {
  Confirmed = 'CONFIRMED',
  Cancelled = 'CANCELLED',
}
