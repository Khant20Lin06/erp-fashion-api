/**
 * Fulfillment lifecycle for an order placed through a bot/online channel —
 * a finer-grained progression than Sale.fulfillmentStatus's own
 * PENDING_SHIPMENT/SHIPPED/DELIVERED (see sale-fulfillment-status.enum.ts),
 * because a delivery-based online order has a real "courier is en route"
 * state a warehouse-shipment sale does not need to track.
 *
 * PENDING_REVIEW -> CONFIRMED -> PACKED -> ON_MY_WAY -> DELIVERED (terminal)
 * PENDING_REVIEW -> CANCELLED (terminal)
 * CONFIRMED -> CANCELLED is allowed (matches Sale.status's own CONFIRMED
 * being non-terminal from OnlineOrder's perspective — the linked Sale
 * itself still only cancels while it's DRAFT; cancelling an OnlineOrder
 * whose Sale is already CONFIRMED requires cancelling the Sale first via
 * the existing sales.cancel-equivalent flow, enforced in the service, not
 * this enum).
 * No transition is ever allowed FROM DELIVERED or CANCELLED — both terminal.
 */
export enum OnlineOrderStatus {
  PendingReview = 'PENDING_REVIEW',
  Confirmed = 'CONFIRMED',
  Packed = 'PACKED',
  OnMyWay = 'ON_MY_WAY',
  Delivered = 'DELIVERED',
  Cancelled = 'CANCELLED',
}
