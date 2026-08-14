import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue, JobsOptions } from 'bullmq';
import Redis from 'ioredis';
import { BULLMQ_CONNECTION } from './bullmq-connection.provider';
import { QueueName, QueueNames } from './queue-names';

/**
 * Default job options applied to every enqueue (Phase 20, locked scope):
 * bounded retries with exponential backoff, and bounded retained job
 * history so Redis never fills up with completed/failed job records
 * indefinitely. Failed jobs are kept longer (and more of them) than
 * completed ones, purely for debugging — this codebase's established
 * "don't silently lose failure evidence" instinct (see OutboxEvent's own
 * FAILED-state retention).
 */
const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 1000 },
};

/**
 * Thin wrapper over BullMQ's `Queue` producer API (Phase 20, locked module
 * boundary — mirrors KafkaProducerService's own "thin explicit wrapper"
 * style rather than pulling in @nestjs/bullmq's decorator abstraction, to
 * stay consistent with how this codebase already wraps kafkajs directly).
 * Domain/consumer code never touches a raw BullMQ `Queue` instance — only
 * this service's `enqueue()`.
 *
 * One `Queue` instance is created per registered queue name at construction
 * time (not lazily per-call) so connection issues surface at boot via the
 * shared BullMQ Redis connection, same as KafkaProducerService's eager
 * connect().
 */
@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly queues = new Map<QueueName, Queue>();

  constructor(@Inject(BULLMQ_CONNECTION) private readonly connection: Redis) {
    for (const name of Object.values(QueueNames)) {
      this.queues.set(name, new Queue(name, { connection: this.connection }));
    }
  }

  private getQueue(name: QueueName): Queue {
    const queue = this.queues.get(name);
    if (!queue) {
      throw new Error(`Unregistered BullMQ queue: ${name}`);
    }
    return queue;
  }

  /**
   * Enqueues a job. `jobId` should be deterministic (e.g.
   * `notification-<notificationId>`, hyphen-delimited — BullMQ's custom
   * job IDs reject `:` since it collides with the Redis key separator
   * BullMQ itself uses internally) whenever the job represents "do this
   * specific thing once" — BullMQ itself then rejects a duplicate add of
   * the same jobId while it's still active/waiting/delayed, rather than
   * silently creating two jobs for the same logical unit of work (locked
   * spec requirement). Errors are logged and rethrown — callers (e.g.
   * NotificationEventConsumer) decide how to handle an enqueue failure;
   * this wrapper never swallows it, since a job that silently fails to
   * enqueue would be a silent notification loss.
   */
  async enqueue<T extends object>(
    queueName: QueueName,
    jobName: string,
    data: T,
    options?: { jobId?: string },
  ): Promise<void> {
    try {
      await this.getQueue(queueName).add(jobName, data, {
        ...DEFAULT_JOB_OPTIONS,
        jobId: options?.jobId,
      });
    } catch (error) {
      this.logger.error(
        `Failed to enqueue job "${jobName}" on queue "${queueName}": ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /** Used by the health check / diagnostics — a real, awaited connectivity probe. */
  async isConnected(): Promise<boolean> {
    try {
      const pong = await this.connection.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(
      Array.from(this.queues.values()).map((queue) =>
        queue.close().catch(() => undefined),
      ),
    );
    await this.connection.quit().catch(() => undefined);
  }
}
