import Redis from 'ioredis';
import { QueueService } from './queue.service';
import { QueueNames } from './queue-names';

const addMock = jest.fn();
const closeMock = jest.fn().mockResolvedValue(undefined);

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: addMock,
    close: closeMock,
  })),
}));

describe('QueueService', () => {
  let service: QueueService;
  let connection: jest.Mocked<Pick<Redis, 'ping' | 'quit'>>;

  beforeEach(() => {
    addMock.mockReset().mockResolvedValue(undefined);
    closeMock.mockReset().mockResolvedValue(undefined);
    connection = {
      ping: jest.fn().mockResolvedValue('PONG'),
      quit: jest.fn().mockResolvedValue('OK'),
    };
    service = new QueueService(connection as unknown as Redis);
  });

  describe('enqueue', () => {
    it('adds a job to the target queue with bounded retry/backoff/cleanup defaults', async () => {
      await service.enqueue(
        QueueNames.NOTIFICATIONS,
        'send-notification',
        { notificationId: 'notif-1' },
        { jobId: 'notification-notif-1' },
      );

      expect(addMock).toHaveBeenCalledTimes(1);
      const [jobName, jobData, jobOptions] = addMock.mock.calls[0] as [
        string,
        unknown,
        Record<string, unknown>,
      ];
      expect(jobName).toBe('send-notification');
      expect(jobData).toEqual({ notificationId: 'notif-1' });
      expect(typeof jobOptions.attempts).toBe('number');
      expect(jobOptions.backoff).toMatchObject({ type: 'exponential' });
      expect(jobOptions.removeOnComplete).toBeDefined();
      expect(jobOptions.removeOnFail).toBeDefined();
      expect(jobOptions.jobId).toBe('notification-notif-1');
    });

    it('rejects enqueueing on an unregistered queue name', async () => {
      await expect(
        service.enqueue('not-a-real-queue' as never, 'x', {}),
      ).rejects.toThrow(/Unregistered BullMQ queue/);
    });

    it('propagates (does not swallow) an enqueue failure', async () => {
      addMock.mockRejectedValue(new Error('Redis unreachable'));

      await expect(
        service.enqueue(QueueNames.NOTIFICATIONS, 'send-notification', {}),
      ).rejects.toThrow('Redis unreachable');
    });
  });

  describe('isConnected', () => {
    it('returns true on a real PING success', async () => {
      await expect(service.isConnected()).resolves.toBe(true);
    });

    it('returns false when the connection throws', async () => {
      connection.ping.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.isConnected()).resolves.toBe(false);
    });
  });

  describe('onModuleDestroy', () => {
    it('closes every registered queue and quits the connection', async () => {
      await service.onModuleDestroy();

      expect(closeMock).toHaveBeenCalled();
      expect(connection.quit).toHaveBeenCalled();
    });
  });
});
