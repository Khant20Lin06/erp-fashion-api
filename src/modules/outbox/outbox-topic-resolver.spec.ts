import { resolveTopicForEventType } from './outbox-topic-resolver';
import { PAYMENT_EVENTS_TOPIC } from './outbox-topics';
import { PAYMENT_CONFIRMED_EVENT_TYPE } from '../payments/events/payment-confirmed.event';

describe('resolveTopicForEventType', () => {
  it('resolves payment.confirmed to the payment events topic', () => {
    expect(resolveTopicForEventType(PAYMENT_CONFIRMED_EVENT_TYPE)).toBe(
      PAYMENT_EVENTS_TOPIC,
    );
    expect(PAYMENT_EVENTS_TOPIC).toBe('erp.payment.events');
  });

  it('throws for an unregistered eventType rather than silently misrouting it', () => {
    expect(() => resolveTopicForEventType('sale.confirmed')).toThrow(
      /No Kafka topic is registered/,
    );
  });
});
