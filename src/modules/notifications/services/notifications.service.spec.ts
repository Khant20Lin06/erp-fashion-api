import { Repository } from 'typeorm';
import { NotificationsService } from './notifications.service';
import { Notification } from '../entities/notification.entity';
import { NotificationStatus } from '../entities/notification-status.enum';
import { NotificationChannel } from '../entities/notification-channel.enum';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let notificationRepository: jest.Mocked<
    Pick<
      Repository<Notification>,
      'findOne' | 'findAndCount' | 'create' | 'save' | 'update'
    >
  >;

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

  beforeEach(() => {
    notificationRepository = {
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };
    service = new NotificationsService(
      notificationRepository as unknown as Repository<Notification>,
    );
  });

  describe('findAll', () => {
    it('returns a paginated, company-scoped result', async () => {
      const notification = buildNotification();
      notificationRepository.findAndCount.mockResolvedValue([
        [notification],
        1,
      ]);

      const result = await service.findAll('company-a', {} as never);

      expect(notificationRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: 'company-a' } }),
      );
      expect(result).toEqual({
        data: [notification],
        meta: { page: 1, limit: 20, total: 1 },
      });
    });
  });

  describe('findByIdInCompany', () => {
    it('throws NotFound for a missing/cross-company id (IDOR-hiding)', async () => {
      notificationRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findByIdInCompany('missing', 'company-a'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });
  });

  describe('markRead', () => {
    it('sets readAt when not already read', async () => {
      const notification = buildNotification({ readAt: null });
      notificationRepository.findOne.mockResolvedValue(notification);
      notificationRepository.save.mockImplementation((input) =>
        Promise.resolve(input as Notification),
      );

      const result = await service.markRead('notif-1', 'company-a');

      expect(result.readAt).not.toBeNull();
      expect(notificationRepository.save).toHaveBeenCalled();
    });

    it('is a no-op (does not re-save) when already read', async () => {
      const readAt = new Date('2026-01-01T00:00:00Z');
      const notification = buildNotification({ readAt });
      notificationRepository.findOne.mockResolvedValue(notification);

      const result = await service.markRead('notif-1', 'company-a');

      expect(result.readAt).toBe(readAt);
      expect(notificationRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('createPending', () => {
    const input = {
      companyId: 'company-a',
      eventType: 'payment.confirmed',
      channel: NotificationChannel.InApp,
      title: 'Payment received',
      body: 'Body',
      data: { paymentId: 'payment-1' },
      sourceEventId: 'event-1',
    };

    it('creates a new PENDING notification when none exists for (sourceEventId, channel)', async () => {
      notificationRepository.findOne.mockResolvedValue(null);
      notificationRepository.create.mockImplementation(
        (data) => data as Notification,
      );
      notificationRepository.save.mockImplementation((data) =>
        Promise.resolve(data as Notification),
      );

      const result = await service.createPending(input);

      expect(result.status).toBe(NotificationStatus.Pending);
      expect(result.sourceEventId).toBe('event-1');
      expect(result.userId).toBeNull();
    });

    it('returns the existing row instead of creating a duplicate (idempotency)', async () => {
      const existing = buildNotification();
      notificationRepository.findOne.mockResolvedValue(existing);

      const result = await service.createPending(input);

      expect(result).toBe(existing);
      expect(notificationRepository.save).not.toHaveBeenCalled();
    });

    it('recovers from a race (ER_DUP_ENTRY) by returning the winning row rather than throwing', async () => {
      const winner = buildNotification();
      notificationRepository.findOne
        .mockResolvedValueOnce(null) // initial check: not found
        .mockResolvedValueOnce(winner); // re-fetch after duplicate-key error
      notificationRepository.create.mockImplementation(
        (data) => data as Notification,
      );
      const dupError = Object.assign(new Error('Duplicate entry'), {
        code: 'ER_DUP_ENTRY',
      });
      notificationRepository.save.mockRejectedValue(dupError);

      const result = await service.createPending(input);

      expect(result).toBe(winner);
    });

    it('rethrows a non-duplicate-key error', async () => {
      notificationRepository.findOne.mockResolvedValue(null);
      notificationRepository.create.mockImplementation(
        (data) => data as Notification,
      );
      notificationRepository.save.mockRejectedValue(new Error('DB is down'));

      await expect(service.createPending(input)).rejects.toThrow('DB is down');
    });
  });

  describe('markSent', () => {
    it('sets status SENT, sentAt, and clears lastError', async () => {
      await service.markSent('notif-1');

      expect(notificationRepository.update).toHaveBeenCalledWith(
        'notif-1',
        expect.objectContaining({
          status: NotificationStatus.Sent,
          lastError: null,
        }),
      );
    });
  });

  describe('markFailed', () => {
    it('sets status FAILED, failedAt, and lastError (truncated to 1000 chars)', async () => {
      const longMessage = 'x'.repeat(2000);

      await service.markFailed('notif-1', longMessage);

      expect(notificationRepository.update).toHaveBeenCalledWith(
        'notif-1',
        expect.objectContaining({
          status: NotificationStatus.Failed,
          lastError: 'x'.repeat(1000),
        }),
      );
    });
  });
});
