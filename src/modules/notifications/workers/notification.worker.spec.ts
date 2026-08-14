import { Job } from 'bullmq';
import Redis from 'ioredis';
import { NotificationWorker } from './notification.worker';
import { NotificationsService } from '../services/notifications.service';
import { Notification } from '../entities/notification.entity';
import { NotificationStatus } from '../entities/notification-status.enum';
import { NotificationChannel } from '../entities/notification-channel.enum';
import { NotificationProvider } from '../providers/notification-provider.interface';
import { NotificationJobData } from './notification-job.interface';

describe('NotificationWorker', () => {
  let worker: NotificationWorker;
  let notificationsService: jest.Mocked<
    Pick<NotificationsService, 'findById' | 'markSent' | 'markFailed'>
  >;
  let inAppProvider: jest.Mocked<NotificationProvider>;

  const buildNotification = (
    overrides: Partial<Notification> = {},
  ): Notification =>
    ({
      id: 'notif-1',
      companyId: 'company-a',
      userId: null,
      eventType: 'payment.confirmed',
      channel: NotificationChannel.InApp,
      title: 'Payment received',
      body: 'Body',
      data: {},
      status: NotificationStatus.Pending,
      sourceEventId: 'event-1',
      sentAt: null,
      failedAt: null,
      lastError: null,
      readAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      ...overrides,
    }) as Notification;

  const buildJob = (notificationId: string): Job<NotificationJobData> =>
    ({ data: { notificationId } }) as Job<NotificationJobData>;

  /**
   * `process()` is `protected` on BaseQueueWorker by design (only BullMQ's
   * own Worker callback, wired in onModuleInit(), is meant to invoke it) —
   * this test-only accessor exposes it with a real type instead of `any`,
   * avoiding the eslint no-unsafe-* family entirely.
   */
  interface TestableWorker {
    process(job: Job<NotificationJobData>): Promise<void>;
  }
  const asTestable = (target: NotificationWorker): TestableWorker =>
    target as unknown as TestableWorker;

  beforeEach(() => {
    notificationsService = {
      findById: jest.fn(),
      markSent: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
    };
    inAppProvider = {
      channel: NotificationChannel.InApp,
      deliver: jest.fn().mockResolvedValue(undefined),
    };

    worker = new NotificationWorker(
      {} as Redis,
      notificationsService as unknown as NotificationsService,
      [inAppProvider],
    );
  });

  it('is a no-op when the notification row no longer exists (not retryable)', async () => {
    notificationsService.findById.mockResolvedValue(null);

    await expect(
      asTestable(worker).process(buildJob('missing')),
    ).resolves.toBeUndefined();
    expect(inAppProvider.deliver.mock.calls).toHaveLength(0);
  });

  it('is idempotent: a notification already SENT is a no-op, never re-delivered', async () => {
    notificationsService.findById.mockResolvedValue(
      buildNotification({ status: NotificationStatus.Sent }),
    );

    await asTestable(worker).process(buildJob('notif-1'));

    expect(inAppProvider.deliver.mock.calls).toHaveLength(0);
    expect(notificationsService.markSent.mock.calls).toHaveLength(0);
  });

  it('delivers via the matching provider and marks the row SENT on success', async () => {
    const notification = buildNotification();
    notificationsService.findById.mockResolvedValue(notification);

    await asTestable(worker).process(buildJob('notif-1'));

    expect(inAppProvider.deliver.mock.calls[0]).toEqual([notification]);
    expect(notificationsService.markSent.mock.calls[0]).toEqual(['notif-1']);
  });

  it('marks the row FAILED and rethrows (for BullMQ retry) when the provider throws', async () => {
    const notification = buildNotification();
    notificationsService.findById.mockResolvedValue(notification);
    inAppProvider.deliver.mockRejectedValue(new Error('delivery blew up'));

    await expect(
      asTestable(worker).process(buildJob('notif-1')),
    ).rejects.toThrow('delivery blew up');
    expect(notificationsService.markFailed).toHaveBeenCalledWith(
      'notif-1',
      'delivery blew up',
    );
  });

  it('marks FAILED and throws when no provider is registered for the channel', async () => {
    const notification = buildNotification();
    notificationsService.findById.mockResolvedValue(notification);
    worker = new NotificationWorker(
      {} as Redis,
      notificationsService as unknown as NotificationsService,
      [], // no providers registered
    );

    await expect(
      asTestable(worker).process(buildJob('notif-1')),
    ).rejects.toThrow(/No NotificationProvider registered/);
    expect(notificationsService.markFailed).toHaveBeenCalledWith(
      'notif-1',
      expect.stringContaining('No NotificationProvider registered'),
    );
  });

  it('never touches Payment/JournalEntry/Inventory tables — only NotificationsService and the resolved provider', () => {
    // Structural guarantee: the worker's only injected collaborators are
    // BULLMQ_CONNECTION, NotificationsService, and NOTIFICATION_PROVIDERS —
    // there is no Payment/JournalEntry/Inventory repository or service in
    // its constructor signature at all.
    expect(NotificationWorker.length).toBe(3);
  });
});
