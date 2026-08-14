/**
 * Topic-naming decision (Phase 18, D9-adjacent, documented in full in
 * docs/EVENT_ARCHITECTURE.md "Topic Naming"): one topic per business
 * domain ("erp.<domain>.events"), not one topic per event type. Since only
 * the Payment domain ships a real event this phase (payment.confirmed),
 * exactly one topic exists — no speculative empty topics are created for
 * Sale/PurchaseOrder/Inventory/Accounting, which have zero real events in
 * this phase's scope. A future Sale event, if ever added, would publish to
 * a new "erp.sale.events" topic rather than being crammed into this one.
 */
export const PAYMENT_EVENTS_TOPIC = 'erp.payment.events';
