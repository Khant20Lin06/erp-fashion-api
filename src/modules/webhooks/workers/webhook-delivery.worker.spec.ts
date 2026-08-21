import { Job } from 'bullmq';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { WebhookDeliveryWorker } from './webhook-delivery.worker';
import { WebhookDeliveryJobData } from './webhook-delivery-job.interface';
import { WebhookDelivery } from '../entities/webhook-delivery.entity';
import { WebhookDeliveryStatus } from '../entities/webhook-delivery-status.enum';
import { WebhookSubscription } from '../entities/webhook-subscription.entity';

describe('WebhookDeliveryWorker', () => {
  let worker: WebhookDeliveryWorker;
  let deliveryRepository: jest.Mocked<
    Pick<Repository<WebhookDelivery>, 'findOne' | 'update'>
  >;
  let subscriptionRepository: jest.Mocked<
    Pick<Repository<WebhookSubscription>, 'findOne' | 'update' | 'increment'>
  >;
  let fetchMock: jest.Mock;

  const buildDelivery = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'delivery-1',
      webhookSubscriptionId: 'wh-1',
      eventId: 'event-1',
      eventType: 'payment.confirmed',
      status: WebhookDeliveryStatus.Pending,
      attempt: 0,
      responseStatus: null,
      responseBody: null,
      errorMessage: null,
      deliveredAt: null,
      ...overrides,
    }) as WebhookDelivery;

  const buildSubscription = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'wh-1',
      companyId: 'company-a',
      url: 'https://example.com/hook',
      secret: 'secret-key',
      isActive: true,
      ...overrides,
    }) as WebhookSubscription;

  const buildJob = (
    data: WebhookDeliveryJobData,
    attemptsMade = 0,
    attempts = 5,
  ): Job<WebhookDeliveryJobData> =>
    ({ data, attemptsMade, opts: { attempts } }) as Job<WebhookDeliveryJobData>;

  interface TestableWorker {
    process(job: Job<WebhookDeliveryJobData>): Promise<void>;
  }
  const asTestable = (target: WebhookDeliveryWorker): TestableWorker =>
    target as unknown as TestableWorker;

  beforeEach(() => {
    deliveryRepository = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    subscriptionRepository = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      increment: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    fetchMock = jest.fn();
    (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;

    const configService = {
      get: jest.fn().mockReturnValue({ webhookWorkerConcurrency: 3 }),
    };

    worker = new WebhookDeliveryWorker(
      {} as Redis,
      configService as unknown as ConfigService,
      deliveryRepository as unknown as Repository<WebhookDelivery>,
      subscriptionRepository as unknown as Repository<WebhookSubscription>,
    );
  });

  it('is a no-op when the delivery row no longer exists', async () => {
    deliveryRepository.findOne.mockResolvedValue(null);

    await asTestable(worker).process(
      buildJob({ webhookDeliveryId: 'missing' }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is idempotent: a delivery already DELIVERED is a no-op, never re-sent', async () => {
    deliveryRepository.findOne.mockResolvedValue(
      buildDelivery({ status: WebhookDeliveryStatus.Delivered }),
    );

    await asTestable(worker).process(
      buildJob({ webhookDeliveryId: 'delivery-1' }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends a signed POST and marks DELIVERED on HTTP 2xx', async () => {
    deliveryRepository.findOne.mockResolvedValue(buildDelivery());
    subscriptionRepository.findOne.mockResolvedValue(buildSubscription());
    fetchMock.mockResolvedValue({
      status: 200,
      text: () => Promise.resolve('{"ok":true}'),
    });

    await asTestable(worker).process(
      buildJob({ webhookDeliveryId: 'delivery-1' }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://example.com/hook');
    expect(
      (init.headers as Record<string, string>)['X-Webhook-Signature'],
    ).toMatch(/^[0-9a-f]{64}$/);
    expect(deliveryRepository.update).toHaveBeenCalledWith(
      'delivery-1',
      expect.objectContaining({
        status: WebhookDeliveryStatus.Delivered,
        responseStatus: 200,
      }),
    );
    expect(subscriptionRepository.update).toHaveBeenCalledWith(
      'wh-1',
      expect.objectContaining({ failureCount: 0 }),
    );
  });

  it('marks PENDING (not FAILED) and rethrows on a non-final HTTP failure so BullMQ retries', async () => {
    deliveryRepository.findOne.mockResolvedValue(buildDelivery({ attempt: 0 }));
    subscriptionRepository.findOne.mockResolvedValue(buildSubscription());
    fetchMock.mockResolvedValue({
      status: 500,
      text: () => Promise.resolve('error'),
    });

    await expect(
      asTestable(worker).process(
        buildJob({ webhookDeliveryId: 'delivery-1' }, 0, 5),
      ),
    ).rejects.toThrow(/HTTP 500/);

    expect(deliveryRepository.update).toHaveBeenLastCalledWith(
      'delivery-1',
      expect.objectContaining({ status: WebhookDeliveryStatus.Pending }),
    );
  });

  it('marks FAILED (retry exhaustion) on the final attempt and increments subscription failureCount', async () => {
    deliveryRepository.findOne.mockResolvedValue(buildDelivery({ attempt: 4 }));
    subscriptionRepository.findOne.mockResolvedValue(buildSubscription());
    fetchMock.mockResolvedValue({
      status: 500,
      text: () => Promise.resolve('error'),
    });

    // attemptsMade=4 means this is attempt #5 of 5 (opts.attempts=5) — the final attempt.
    await expect(
      asTestable(worker).process(
        buildJob({ webhookDeliveryId: 'delivery-1' }, 4, 5),
      ),
    ).rejects.toThrow(/HTTP 500/);

    expect(deliveryRepository.update).toHaveBeenLastCalledWith(
      'delivery-1',
      expect.objectContaining({ status: WebhookDeliveryStatus.Failed }),
    );
    expect(subscriptionRepository.increment).toHaveBeenCalledWith(
      { id: 'wh-1' },
      'failureCount',
      1,
    );
  });

  it('marks FAILED without sending when the subscription is inactive', async () => {
    deliveryRepository.findOne.mockResolvedValue(buildDelivery());
    subscriptionRepository.findOne.mockResolvedValue(
      buildSubscription({ isActive: false }),
    );

    await asTestable(worker).process(
      buildJob({ webhookDeliveryId: 'delivery-1' }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(deliveryRepository.update).toHaveBeenCalledWith(
      'delivery-1',
      expect.objectContaining({
        status: WebhookDeliveryStatus.Failed,
        errorMessage: 'Webhook subscription is inactive',
      }),
    );
  });

  it('never includes the subscription secret in the request body', async () => {
    deliveryRepository.findOne.mockResolvedValue(buildDelivery());
    subscriptionRepository.findOne.mockResolvedValue(buildSubscription());
    fetchMock.mockResolvedValue({
      status: 200,
      text: () => Promise.resolve(''),
    });

    await asTestable(worker).process(
      buildJob({ webhookDeliveryId: 'delivery-1' }),
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body as string).not.toContain('secret-key');
  });
});
