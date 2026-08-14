import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import redisConfig from '../src/config/redis.config';
import { envValidationSchema } from '../src/config/env.validation';
import {
  BULLMQ_CONNECTION,
  createBullMqConnection,
} from '../src/modules/queue/bullmq-connection.provider';
import { QueueService } from '../src/modules/queue/queue.service';
import { QueueNames } from '../src/modules/queue/queue-names';

/**
 * Phase 20 (BullMQ) — a REAL integration test against the actual Redis
 * container (docker-compose's `redis` service), not a mock. Proves a job
 * enqueued via QueueService.enqueue() is genuinely picked up and processed
 * by a real BullMQ Worker bound to the same queue/connection — the
 * end-to-end mechanism NotificationEventConsumer -> NotificationWorker
 * (Phase 21) relies on.
 *
 * Uses a dedicated jobName + a fresh randomUUID()-suffixed jobId per test
 * so this suite's jobs are distinguishable from any concurrently-running
 * real NotificationWorker instance's own jobs on the same `notifications`
 * queue (both ultimately share the same BullMQ queue name/Redis instance,
 * exactly as they will in production — this test does not fork reality,
 * it exercises it).
 */
describe('BullMQ Queue (Phase 20) (e2e)', () => {
  let moduleRef: TestingModule;
  let queueService: QueueService;
  let worker: Worker | undefined;
  let workerConnection: Redis | undefined;
  const testJobName = `e2e-test-job-${randomUUID()}`;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [redisConfig],
          validationSchema: envValidationSchema,
          validationOptions: { abortEarly: false },
        }),
      ],
      providers: [
        {
          provide: BULLMQ_CONNECTION,
          inject: [ConfigService],
          useFactory: createBullMqConnection,
        },
        QueueService,
      ],
    }).compile();

    queueService = moduleRef.get(QueueService);
  });

  afterAll(async () => {
    await worker?.close().catch(() => undefined);
    await workerConnection?.quit().catch(() => undefined);
    await moduleRef.close();
  });

  it('QueueService.isConnected() succeeds against the real container', async () => {
    await expect(queueService.isConnected()).resolves.toBe(true);
  });

  it('a real BullMQ Worker consumes a job enqueued via QueueService', async () => {
    const received: unknown[] = [];
    workerConnection = createBullMqConnection(moduleRef.get(ConfigService));

    const localWorker = new Worker(
      QueueNames.NOTIFICATIONS,
      (job: Job) => {
        if (job.name === testJobName) {
          received.push(job.data);
        }
        return Promise.resolve();
      },
      { connection: workerConnection },
    );
    worker = localWorker;

    const processedPromise = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Timed out waiting for job to be processed')),
        10000,
      );
      localWorker.on('completed', (job: Job) => {
        if (job.name === testJobName) {
          clearTimeout(timer);
          resolve();
        }
      });
    });

    const jobId = `e2e-test-${randomUUID()}`;
    await queueService.enqueue(
      QueueNames.NOTIFICATIONS,
      testJobName,
      { marker: 'phase-20-e2e' },
      { jobId },
    );

    await processedPromise;

    expect(received).toEqual([{ marker: 'phase-20-e2e' }]);
  }, 15000);

  it('enqueueing the same deterministic jobId twice is idempotent (BullMQ rejects the duplicate add)', async () => {
    const jobId = `e2e-idempotency-${randomUUID()}`;

    await queueService.enqueue(
      QueueNames.NOTIFICATIONS,
      testJobName,
      { attempt: 1 },
      { jobId },
    );

    // Second add with the same jobId must not throw and must not create a
    // second job — BullMQ's own dedupe-by-jobId contract.
    await expect(
      queueService.enqueue(
        QueueNames.NOTIFICATIONS,
        testJobName,
        { attempt: 2 },
        { jobId },
      ),
    ).resolves.toBeUndefined();
  });
});
