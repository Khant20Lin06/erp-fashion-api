import {
  PAYMENT_CONFIRMED_EVENT_TYPE,
  PAYMENT_CONFIRMED_EVENT_VERSION,
  PAYMENT_AGGREGATE_TYPE,
  PaymentConfirmedEventPayload,
} from './payment-confirmed.event';
import { PaymentDirection } from '../entities/payment-direction.enum';

describe('payment.confirmed event contract', () => {
  it('names the event using dot notation and starts at version 1', () => {
    expect(PAYMENT_CONFIRMED_EVENT_TYPE).toBe('payment.confirmed');
    expect(PAYMENT_CONFIRMED_EVENT_VERSION).toBe(1);
    expect(PAYMENT_AGGREGATE_TYPE).toBe('Payment');
  });

  it('the payload contains only the allow-listed fields — no raw entity dump, no audit/internal columns', () => {
    const payload: PaymentConfirmedEventPayload = {
      paymentId: 'payment-1',
      paymentNumber: 'PMT-2026-000001',
      direction: PaymentDirection.Receipt,
      amount: '100.00',
      currency: 'USD',
      paymentMethodId: 'pm-1',
      customerId: 'cust-1',
      supplierId: null,
      paymentDate: '2026-08-13T00:00:00.000Z',
      allocationIds: ['alloc-1', 'alloc-2'],
    };

    const allowedKeys = new Set([
      'paymentId',
      'paymentNumber',
      'direction',
      'amount',
      'currency',
      'paymentMethodId',
      'customerId',
      'supplierId',
      'paymentDate',
      'allocationIds',
    ]);

    for (const key of Object.keys(payload)) {
      expect(allowedKeys.has(key)).toBe(true);
    }

    // Explicitly excluded fields that a raw Payment entity dump would have
    // included — these must never appear on the wire.
    const excludedFields = [
      'idempotencyKey',
      'createdBy',
      'updatedBy',
      'createdAt',
      'updatedAt',
      'deletedAt',
      'notes',
      'reference',
      'status',
      'companyId',
      'branchId',
    ];
    for (const field of excludedFields) {
      expect(field in payload).toBe(false);
    }
  });

  it('a serialized payload never contains anything secret-shaped', () => {
    const payload: PaymentConfirmedEventPayload = {
      paymentId: 'payment-1',
      paymentNumber: 'PMT-2026-000001',
      direction: PaymentDirection.Payment,
      amount: '250.00',
      currency: 'USD',
      paymentMethodId: 'pm-1',
      customerId: null,
      supplierId: 'sup-1',
      paymentDate: '2026-08-13T00:00:00.000Z',
      allocationIds: ['alloc-1'],
    };

    const serialized = JSON.stringify(payload).toLowerCase();
    expect(serialized).not.toMatch(/password/);
    expect(serialized).not.toMatch(/secret/);
    expect(serialized).not.toMatch(/token/);
  });
});
