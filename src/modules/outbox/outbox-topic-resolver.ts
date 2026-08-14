import { PAYMENT_EVENTS_TOPIC } from './outbox-topics';

/**
 * Maps an OutboxEvent row's eventType to the Kafka topic it publishes to.
 * A lookup table rather than a naming-convention-derived string so adding a
 * genuinely new domain later is one explicit line here, not an implicit
 * string-transform that could silently misroute an event. Only
 * "payment.confirmed" is registered in this phase's scope (D9: no
 * speculative topics for domains with zero real events).
 */
const EVENT_TYPE_TO_TOPIC: Record<string, string> = {
  'payment.confirmed': PAYMENT_EVENTS_TOPIC,
};

export function resolveTopicForEventType(eventType: string): string {
  const topic = EVENT_TYPE_TO_TOPIC[eventType];
  if (!topic) {
    throw new Error(
      `No Kafka topic is registered for eventType "${eventType}" — add it to EVENT_TYPE_TO_TOPIC in outbox-topic-resolver.ts`,
    );
  }
  return topic;
}
