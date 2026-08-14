import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import Redis from 'ioredis';
import { QueueName } from './queue-names';

/**
 * Base class for an in-process BullMQ worker (Phase 20, locked
 * architecture decision — worker(s) run inside this same Nest application
 * process, as injectable classes, rather than a separate OS
 * process/container; see QueueModule's own docblock for the full
 * rationale). Concrete subclasses (e.g. NotificationWorker in Phase 21)
 * implement `process()` and pass their queue name + concurrency to
 * `super()`; this base class owns the BullMQ `Worker` instance's
 * lifecycle (start on module init, graceful close on module destroy) and
 * uniform success/failure logging.
 *
 * HARD BOUNDARY (locked spec, verified by grep in the final report): no
 * subclass of this class may perform a financial mutation — no writing to
 * Payment/JournalEntry/Inventory tables. Workers only ever touch their own
 * domain's downstream-effect tables (e.g. Notification).
 */
export abstract class BaseQueueWorker<T extends object>
  implements OnModuleInit, OnModuleDestroy
{
  protected readonly logger: Logger;
  private worker?: Worker<T>;

  protected constructor(
    private readonly queueName: QueueName,
    private readonly connection: Redis,
    private readonly concurrency: number = 5,
  ) {
    this.logger = new Logger(this.constructor.name);
  }

  /** Subclasses implement the actual job handling here. Throwing triggers BullMQ's own bounded-retry/backoff (configured at enqueue time by QueueService). */
  protected abstract process(job: Job<T>): Promise<void>;

  onModuleInit(): void {
    this.worker = new Worker<T>(
      this.queueName,
      async (job: Job<T>) => this.process(job),
      { connection: this.connection, concurrency: this.concurrency },
    );

    this.worker.on('completed', (job: Job<T>) => {
      this.logger.log(`Job ${job.id} (${job.name}) completed`);
    });

    this.worker.on('failed', (job: Job<T> | undefined, error: Error) => {
      this.logger.warn(
        `Job ${job?.id ?? 'unknown'} (${job?.name ?? 'unknown'}) failed (attempt ${job?.attemptsMade ?? '?'}): ${error.message}`,
      );
    });

    this.logger.log(
      `BullMQ worker started for queue "${this.queueName}" (concurrency=${this.concurrency})`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close().catch(() => undefined);
  }
}
