import { Job } from 'bullmq';
import Redis from 'ioredis';
import { BaseQueueWorker } from './base-queue-worker';
import { QueueNames } from './queue-names';

let capturedProcessor: ((job: Job) => Promise<void>) | undefined;
const onMock = jest.fn();
const closeMock = jest.fn().mockResolvedValue(undefined);

jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation((_name, processor) => {
    capturedProcessor = processor as (job: Job) => Promise<void>;
    return { on: onMock, close: closeMock };
  }),
}));

interface TestJobData {
  id: string;
}

class TestWorker extends BaseQueueWorker<TestJobData> {
  public processed: string[] = [];
  public shouldThrow = false;

  constructor(connection: Redis) {
    super(QueueNames.NOTIFICATIONS, connection, 3);
  }

  protected process(job: Job<TestJobData>): Promise<void> {
    if (this.shouldThrow) {
      return Promise.reject(new Error('processing failed'));
    }
    this.processed.push(job.data.id);
    return Promise.resolve();
  }
}

describe('BaseQueueWorker', () => {
  let worker: TestWorker;
  let connection: Redis;

  beforeEach(() => {
    capturedProcessor = undefined;
    onMock.mockReset();
    closeMock.mockReset().mockResolvedValue(undefined);
    connection = {} as Redis;
    worker = new TestWorker(connection);
  });

  it('starts a BullMQ Worker bound to the queue on module init', () => {
    worker.onModuleInit();

    expect(capturedProcessor).toBeDefined();
    expect(onMock).toHaveBeenCalledWith('completed', expect.any(Function));
    expect(onMock).toHaveBeenCalledWith('failed', expect.any(Function));
  });

  it('delegates each job to the subclass process() implementation', async () => {
    worker.onModuleInit();

    await capturedProcessor!({ data: { id: 'job-1' } } as Job<TestJobData>);

    expect(worker.processed).toEqual(['job-1']);
  });

  it('lets a process() failure propagate to BullMQ (for its own retry/backoff)', async () => {
    worker.shouldThrow = true;
    worker.onModuleInit();

    await expect(
      capturedProcessor!({ data: { id: 'job-1' } } as Job<TestJobData>),
    ).rejects.toThrow('processing failed');
  });

  it('closes the underlying Worker on module destroy', async () => {
    worker.onModuleInit();
    await worker.onModuleDestroy();

    expect(closeMock).toHaveBeenCalled();
  });

  it('does not throw on module destroy if the worker was never initialized', async () => {
    await expect(worker.onModuleDestroy()).resolves.toBeUndefined();
  });
});
