/**
 * Post-confirmation fulfillment tracking — deliberately separate from
 * SaleStatus (DRAFT/CONFIRMED/CANCELLED), which is a Phase 12 locked
 * decision that must not be extended with shipping/delivery states. A sale
 * only starts fulfillment tracking once CONFIRMED; fulfillmentStatus stays
 * null for DRAFT/CANCELLED sales.
 */
export enum SaleFulfillmentStatus {
  PendingShipment = 'PENDING_SHIPMENT',
  Shipped = 'SHIPPED',
  Delivered = 'DELIVERED',
}
