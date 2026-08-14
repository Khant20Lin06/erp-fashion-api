import { PaymentDirection } from '../entities/payment-direction.enum';

/**
 * The one real event this phase ships (Phase 18 D9, LOCKED — Payment-only
 * scope). Emitted once, at the very end of PaymentsService.create()'s
 * transaction, immediately after AccountingPostingService.postPayment()
 * (D4 boundary: this is purely additive next to Phase 17's synchronous GL
 * posting, never a replacement for it).
 *
 * Deliberately NOT a raw entity dump (locked spec: "the payment.confirmed
 * payload never contains raw entity dumps or excluded fields") — a
 * hand-picked, stable set of scalar identifiers and amounts a consumer
 * actually needs. No idempotencyKey, no createdBy/updatedBy audit columns,
 * no internal row ids beyond what a consumer needs to reference the source
 * documents (paymentId, allocationIds). eventVersion=1 is this payload
 * shape's contract — a future breaking change to this shape would ship as
 * eventVersion=2 with both versions handled by consumers during migration,
 * never a silent shape change under the same version.
 */
export const PAYMENT_CONFIRMED_EVENT_TYPE = 'payment.confirmed';
export const PAYMENT_CONFIRMED_EVENT_VERSION = 1;
export const PAYMENT_AGGREGATE_TYPE = 'Payment';

export interface PaymentConfirmedEventPayload extends Record<string, unknown> {
  paymentId: string;
  paymentNumber: string;
  direction: PaymentDirection;
  amount: string;
  currency: string;
  paymentMethodId: string;
  customerId: string | null;
  supplierId: string | null;
  paymentDate: string;
  allocationIds: string[];
}
