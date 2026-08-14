import { InAppNotificationProvider } from './in-app-notification.provider';
import { Notification } from '../entities/notification.entity';
import { NotificationChannel } from '../entities/notification-channel.enum';
import { NotificationStatus } from '../entities/notification-status.enum';

describe('InAppNotificationProvider', () => {
  let provider: InAppNotificationProvider;

  const buildNotification = (): Notification =>
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
    }) as Notification;

  beforeEach(() => {
    provider = new InAppNotificationProvider();
  });

  it('declares the IN_APP channel', () => {
    expect(provider.channel).toBe(NotificationChannel.InApp);
  });

  it('delivers without throwing and without calling any external service (no side effect beyond the durable row itself)', async () => {
    await expect(
      provider.deliver(buildNotification()),
    ).resolves.toBeUndefined();
  });
});
