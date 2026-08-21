import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { KafkaConsumerService } from '../../kafka/kafka-consumer.service';
import { KafkaConsumedMessage } from '../../kafka/kafka-consumer.interface';
import { ProcessedEvent } from '../../outbox/entities/processed-event.entity';
import { PAYMENT_EVENTS_TOPIC } from '../../outbox/outbox-topics';
import { PAYMENT_CONFIRMED_EVENT_TYPE } from '../events/payment-confirmed.event';
import type { EventEnvelope } from '../../outbox/interfaces/event-envelope.interface';
import { KafkaConfig } from '../../../config/kafka.config';
import {
  isOpenApiGenerationMode,
  isWorkerRuntimeRole,
} from '../../../shared/utils/runtime-flags';

/**
 * Consumer group id — fixed and meaningful (never random/per-process), so
 * offsets and processed_events rows persist across restarts and multiple
 * running instances load-balance the topic's partitions rather than each
 * seeing every message (locked spec requirement).
 */
export const PAYMENT_AUDIT_CONSUMER_NAME = 'erp-payment-audit-consumer';

/**
 * Minimum real, wired-end-to-end consumer (Phase 18 — proves the whole
 * pipeline and exercises the idempotency design without inventing a fake
 * notification system or touching any financial state). Subscribes to
 * erp.payment.events under a fixed consumer group and, for each
 * payment.confirmed message, logs a structured audit line — a genuine,
 * harmless business purpose (proof of delivery / audit trail).
 *
 * Idempotency (D6, LOCKED): every message goes through processed_events
 * BEFORE the side effect (the log line) —
 *   1. check for an existing (event_id, consumer_name) row
 *   2. if present: no-op (already processed this exact event by this
 *      consumer — a Kafka redelivery, e.g. after a crash before offset
 *      commit or a rebalance)
 *   3. if absent: do the side effect, then INSERT the processed_events row
 * Both the existence check and the insert use the DB — never an in-memory
 * Set, which would not survive a restart and would not be shared across
 * instances of this consumer.
 *
 * The insert's UNIQUE(event_id, consumer_name) constraint is the race
 * backstop for two overlapping deliveries of the same event (e.g. during a
 * rebalance): whichever insert loses the race gets ER_DUP_ENTRY, which is
 * caught and treated as "already processed" rather than an error.
 */
@Injectable()
export class PaymentEventConsumer implements OnModuleInit {
  private readonly logger = new Logger(PaymentEventConsumer.name);

  constructor(
    private readonly kafkaConsumerService: KafkaConsumerService,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (isOpenApiGenerationMode() || !isWorkerRuntimeRole()) {
      return;
    }

    const kafkaConfig = this.configService.get<KafkaConfig>('kafka')!;
    await this.kafkaConsumerService.run(
      kafkaConfig.groupId,
      [PAYMENT_EVENTS_TOPIC],
      (message) => this.handleMessage(message),
    );
  }

  async handleMessage(message: KafkaConsumedMessage): Promise<void> {
    if (!message.value) {
      this.logger.warn(
        'Received payment event message with empty value — skipping',
      );
      return;
    }

    let envelope: EventEnvelope;
    try {
      envelope = JSON.parse(message.value) as EventEnvelope;
    } catch {
      this.logger.error(
        'Received unparseable payment event message — skipping',
      );
      return;
    }

    if (envelope.eventType !== PAYMENT_CONFIRMED_EVENT_TYPE) {
      // Forward-compatible: a future eventType on this same topic that this
      // consumer version doesn't know about yet is skipped, not an error.
      return;
    }

    await this.processIdempotently(envelope);
  }

  private async processIdempotently(envelope: EventEnvelope): Promise<void> {
    const alreadyProcessed = await this.dataSource
      .getRepository(ProcessedEvent)
      .findOne({
        where: {
          eventId: envelope.eventId,
          consumerName: PAYMENT_AUDIT_CONSUMER_NAME,
        },
      });

    if (alreadyProcessed) {
      this.logger.log(
        `Skipping already-processed event ${envelope.eventId} (duplicate delivery to ${PAYMENT_AUDIT_CONSUMER_NAME})`,
      );
      return;
    }

    // The side effect itself — structured audit log line. Deliberately the
    // ONLY effect this consumer has (no financial state is touched).
    this.logger.log(
      `payment.confirmed audit: eventId=${envelope.eventId} paymentId=${envelope.aggregateId} companyId=${envelope.companyId} occurredAt=${envelope.occurredAt}`,
    );

    try {
      await this.dataSource.getRepository(ProcessedEvent).insert({
        eventId: envelope.eventId,
        consumerName: PAYMENT_AUDIT_CONSUMER_NAME,
        processedAt: new Date(),
      });
    } catch (error) {
      if (!this.isDuplicateProcessedEventError(error)) {
        throw error;
      }
      // Lost the race to a concurrent redelivery having already recorded
      // this (event_id, consumer_name) pair — the side effect above may
      // have logged twice in that narrow race window, which is the
      // documented at-least-once tradeoff (D6); the durable
      // processed_events row is what guarantees no *third* redelivery ever
      // repeats the side effect again.
      this.logger.log(
        `Concurrent redelivery detected for event ${envelope.eventId} — processed_events row already exists`,
      );
    }
  }

  private isDuplicateProcessedEventError(error: unknown): boolean {
    const err = error as {
      code?: string;
      errno?: number;
      driverError?: { code?: string; errno?: number };
    };
    const code = err?.code ?? err?.driverError?.code;
    const errno = err?.errno ?? err?.driverError?.errno;
    return code === 'ER_DUP_ENTRY' || errno === 1062;
  }
}
