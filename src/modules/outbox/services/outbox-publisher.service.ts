import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { OutboxEvent } from '../entities/outbox-event.entity';
import { OutboxEventStatus } from '../entities/outbox-event-status.enum';
import { KafkaProducerService } from '../../kafka/kafka-producer.service';
import { resolveTopicForEventType } from '../outbox-topic-resolver';
import { computeBackoffMs, sanitizeErrorMessage } from '../utils/backoff';
import { OutboxConfig } from '../../../config/outbox.config';

/**
 * Polling publisher (Phase 18, D5 LOCKED — no CDC/Debezium/Kafka Connect).
 * Runs on a fixed interval (OUTBOX_POLL_INTERVAL_MS, registered dynamically
 * via SchedulerRegistry rather than a static @Interval() decorator so the
 * interval is configurable through ConfigService rather than hardcoded).
 *
 * Each tick, in three distinct phases (never overlapping a DB transaction
 * with the Kafka network call — D2/D3 LOCKED):
 *
 *   1. SHORT claim transaction: SELECT ... FOR UPDATE SKIP LOCKED a batch
 *      of PENDING/FAILED rows whose available_at has elapsed, ordered by
 *      available_at, then immediately mark them nothing yet (no status
 *      change at claim time — claim is just "read+lock+release", not a
 *      fourth PROCESSING status) and commit. SKIP LOCKED means a second
 *      concurrent publisher instance's simultaneous claim query never waits
 *      on rows the first instance is mid-claim on — it simply skips them
 *      and claims a disjoint set, so two publishers never double-claim the
 *      same row (proven by a real Promise.all() concurrency test).
 *   2. OUTSIDE any DB transaction: publish each claimed event to Kafka.
 *   3. SHORT update per event: on success, PUBLISHED + published_at; on
 *      failure, attempt_count+1, sanitized last_error, backoff-advanced
 *      available_at, status stays/reverts to FAILED (still retryable —
 *      never a dead/abandoned terminal state in this phase's scope).
 */
/** Fixed name the polling interval is registered/deregistered under in SchedulerRegistry. */
export const OUTBOX_PUBLISHER_INTERVAL_NAME = 'outbox-publisher-poll';

@Injectable()
export class OutboxPublisherService implements OnModuleDestroy {
  private readonly logger = new Logger(OutboxPublisherService.name);
  private ticking = false;
  private started = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  /** Registers the polling interval dynamically so it can be started once and reasoned about explicitly (see OutboxModule.onModuleInit). */
  start(): void {
    const outboxConfig = this.configService.get<OutboxConfig>('outbox')!;
    const interval = setInterval(() => {
      void this.tick();
    }, outboxConfig.pollIntervalMs);
    // Prevent this interval from keeping a test process (or a graceful
    // shutdown) alive when nothing else is happening.
    interval.unref?.();
    this.schedulerRegistry.addInterval(
      OUTBOX_PUBLISHER_INTERVAL_NAME,
      interval,
    );
    this.started = true;
  }

  /**
   * Stops the polling interval when this module's owning Nest application
   * context shuts down (e.g. `app.close()` in every e2e test, or a real
   * graceful shutdown). Without this, `unref()` merely stops the interval
   * from keeping the process alive — it does NOT stop the interval from
   * still firing on its own schedule against a DataSource/Kafka client that
   * the rest of the application has already torn down, which previously
   * surfaced as "Connection is not established with mysql database" and
   * "You are trying to `require` a file after the Jest environment has been
   * torn down" errors bleeding into unrelated e2e suites that ran after an
   * app instance with this module was closed. Guarded with a try/catch
   * because SchedulerRegistry.deleteInterval() throws if the interval was
   * already removed (e.g. a test explicitly cleared it itself, see
   * outbox.e2e-spec.ts).
   */
  onModuleDestroy(): void {
    if (!this.started) {
      return;
    }
    try {
      this.schedulerRegistry.deleteInterval(OUTBOX_PUBLISHER_INTERVAL_NAME);
    } catch {
      // Already removed — nothing to do.
    }
    this.started = false;
  }

  /**
   * A single poll cycle: claim -> publish -> record outcome. Re-entrancy
   * guarded by `ticking` so a slow Kafka round-trip on one tick can never
   * overlap a second tick's claim query against the same in-process
   * publisher instance (a separate publisher *process* is still safely
   * handled by SKIP LOCKED, per the class docblock).
   */
  async tick(): Promise<void> {
    if (this.ticking) {
      return;
    }
    this.ticking = true;
    try {
      const claimed = await this.claimBatch();
      for (const event of claimed) {
        await this.publishOne(event);
      }
    } catch (error) {
      this.logger.error(
        `Outbox publisher tick failed: ${(error as Error).message}`,
      );
    } finally {
      this.ticking = false;
    }
  }

  private async claimBatch(): Promise<OutboxEvent[]> {
    const outboxConfig = this.configService.get<OutboxConfig>('outbox')!;
    return this.dataSource.transaction(async (manager) => {
      return manager
        .createQueryBuilder(OutboxEvent, 'event')
        .where('event.status IN (:...statuses)', {
          statuses: [OutboxEventStatus.Pending, OutboxEventStatus.Failed],
        })
        .andWhere('event.availableAt <= :now', { now: new Date() })
        .orderBy('event.availableAt', 'ASC')
        .limit(outboxConfig.batchSize)
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .getMany();
    });
  }

  private async publishOne(event: OutboxEvent): Promise<void> {
    try {
      const topic = resolveTopicForEventType(event.eventType);
      await this.kafkaProducer.publish({
        topic,
        key: event.aggregateId,
        value: JSON.stringify(event.toEnvelope()),
        headers: {
          'x-event-id': event.eventId,
          'x-event-type': event.eventType,
          'x-correlation-id': event.correlationId ?? '',
          'x-causation-id': event.causationId ?? '',
        },
      });
      await this.markPublished(event.id);
    } catch (error) {
      await this.markFailed(event, error);
    }
  }

  private async markPublished(id: string): Promise<void> {
    await this.dataSource.getRepository(OutboxEvent).update(id, {
      status: OutboxEventStatus.Published,
      publishedAt: new Date(),
    });
  }

  private async markFailed(event: OutboxEvent, error: unknown): Promise<void> {
    const attemptCount = event.attemptCount + 1;
    const delayMs = computeBackoffMs(attemptCount);
    await this.dataSource.getRepository(OutboxEvent).update(event.id, {
      status: OutboxEventStatus.Failed,
      attemptCount,
      lastError: sanitizeErrorMessage(error),
      availableAt: new Date(Date.now() + delayMs),
    });
    this.logger.warn(
      `Failed to publish outbox event ${event.eventId} (${event.eventType}), attempt ${attemptCount}, retrying in ${delayMs}ms`,
    );
  }
}
