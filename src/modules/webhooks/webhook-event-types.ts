import { PAYMENT_CONFIRMED_EVENT_TYPE } from '../payments/events/payment-confirmed.event';

/**
 * Deliberately closed, evidence-based event registry — the phase's own
 * "only expose events backed by real business actions" rule. Only
 * `payment.confirmed` is wired today because it is the only event type
 * that already flows through the existing Outbox -> Kafka pipeline
 * (erp.payment.events, produced by PaymentsService.create()). Adding a
 * new event here requires the source module to actually emit it via
 * OutboxService.create() first — this list is never speculative.
 */
export const SUPPORTED_WEBHOOK_EVENT_TYPES = [
  PAYMENT_CONFIRMED_EVENT_TYPE,
] as const;

export type SupportedWebhookEventType =
  (typeof SUPPORTED_WEBHOOK_EVENT_TYPES)[number];
