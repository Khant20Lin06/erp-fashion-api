import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { KafkaConsumerService } from '../../kafka/kafka-consumer.service';
import { KafkaConsumedMessage } from '../../kafka/kafka-consumer.interface';
import { ProcessedEvent } from '../../outbox/entities/processed-event.entity';
import { PAYMENT_EVENTS_TOPIC } from '../../outbox/outbox-topics';
import { PAYMENT_CONFIRMED_EVENT_TYPE } from '../../payments/events/payment-confirmed.event';
import type { PaymentConfirmedEventPayload } from '../../payments/events/payment-confirmed.event';
import type { EventEnvelope } from '../../outbox/interfaces/event-envelope.interface';
import { PaymentDirection } from '../../payments/entities/payment-direction.enum';
import { NotificationsService } from '../services/notifications.service';
import { NotificationChannel } from '../entities/notification-channel.enum';
import { QueueService } from '../../queue/queue.service';
import { QueueNames } from '../../queue/queue-names';
import { SEND_NOTIFICATION_JOB } from '../workers/notification-job.interface';
import {
  isOpenApiGenerationMode,
  isWorkerRuntimeRole,
} from '../../../shared/utils/runtime-flags';

/**
 * Fixed, meaningful consumer group id (never random/per-process — same
 * rationale as PAYMENT_AUDIT_CONSUMER_NAME) — a SEPARATE consumer group
 * from erp-payment-audit-consumer, so both consumers independently receive
 * every message on erp.payment.events (Kafka delivers each message to
 * every distinct consumer group subscribed to a topic).
 */
export const NOTIFICATION_CONSUMER_NAME = 'erp-notification-consumer';

/**
 * Phase 21's second real consumer of the EXISTING erp.payment.events topic
 * (no new Kafka topic, no new Kafka event, no change whatsoever to
 * PaymentEventConsumer or PaymentsService — this consumer is purely
 * additive). Mirrors PaymentEventConsumer's exact structure and
 * idempotency pattern (processed_events check BEFORE any side effect,
 * insert AFTER, ER_DUP_ENTRY/errno-1062 caught as a race backstop, never
 * an in-memory dedupe set).
 *
 * This consumer's job is deliberately narrow and fast — it must never call
 * an external provider or do anything slow inline (locked spec):
 *   1. Check processed_events for (eventId, NOTIFICATION_CONSUMER_NAME).
 *   2. Create a Notification row (status PENDING) — idempotent via
 *      NotificationsService.createPending()'s own UNIQUE(source_event_id,
 *      channel) handling, a second independent idempotency layer.
 *   3. Enqueue a BullMQ job on the `notifications` queue carrying only the
 *      Notification's id (never its full payload) with a deterministic
 *      jobId (`notification:<notificationId>`) so BullMQ itself rejects a
 *      duplicate enqueue of the same logical job.
 *   4. Record processed_events.
 *
 * HARD BOUNDARY (verified by grep in the final report): this class never
 * touches Payment/JournalEntry/Inventory tables — only reads the event
 * envelope and writes Notification + ProcessedEvent rows.
 */
@Injectable()
export class NotificationEventConsumer implements OnModuleInit {
  private readonly logger = new Logger(NotificationEventConsumer.name);

  constructor(
    private readonly kafkaConsumerService: KafkaConsumerService,
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
    private readonly queueService: QueueService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (isOpenApiGenerationMode() || !isWorkerRuntimeRole()) {
      return;
    }

    await this.kafkaConsumerService.run(
      NOTIFICATION_CONSUMER_NAME,
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

    let envelope: EventEnvelope<PaymentConfirmedEventPayload>;
    try {
      envelope = JSON.parse(
        message.value,
      ) as EventEnvelope<PaymentConfirmedEventPayload>;
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

  private async processIdempotently(
    envelope: EventEnvelope<PaymentConfirmedEventPayload>,
  ): Promise<void> {
    const alreadyProcessed = await this.dataSource
      .getRepository(ProcessedEvent)
      .findOne({
        where: {
          eventId: envelope.eventId,
          consumerName: NOTIFICATION_CONSUMER_NAME,
        },
      });

    if (alreadyProcessed) {
      this.logger.log(
        `Skipping already-processed event ${envelope.eventId} (duplicate delivery to ${NOTIFICATION_CONSUMER_NAME})`,
      );
      return;
    }

    const notification = await this.notificationsService.createPending({
      companyId: envelope.companyId,
      eventType: envelope.eventType,
      channel: NotificationChannel.InApp,
      title: this.buildTitle(envelope.payload),
      body: this.buildBody(envelope.payload),
      data: {
        paymentId: envelope.payload.paymentId,
        paymentNumber: envelope.payload.paymentNumber,
        direction: envelope.payload.direction,
        amount: envelope.payload.amount,
        currency: envelope.payload.currency,
      },
      sourceEventId: envelope.eventId,
    });

    try {
      await this.queueService.enqueue(
        QueueNames.NOTIFICATIONS,
        SEND_NOTIFICATION_JOB,
        {
          notificationId: notification.id,
          correlationId: envelope.correlationId,
        },
        { jobId: `notification-${notification.id}` },
      );
    } catch (error) {
      // A failed enqueue must not silently drop the event as "processed" —
      // do NOT record processed_events below in that case, so Kafka
      // redelivers the message and this consumer gets another chance
      // (createPending() above is idempotent, so re-running is safe).
      this.logger.error(
        `Failed to enqueue notification job for event ${envelope.eventId}: ${(error as Error).message}`,
      );
      throw error;
    }

    try {
      await this.dataSource.getRepository(ProcessedEvent).insert({
        eventId: envelope.eventId,
        consumerName: NOTIFICATION_CONSUMER_NAME,
        processedAt: new Date(),
      });
    } catch (error) {
      if (!this.isDuplicateProcessedEventError(error)) {
        throw error;
      }
      this.logger.log(
        `Concurrent redelivery detected for event ${envelope.eventId} — processed_events row already exists`,
      );
    }
  }

  private buildTitle(payload: PaymentConfirmedEventPayload): string {
    return payload.direction === PaymentDirection.Receipt
      ? `Payment received: ${payload.paymentNumber}`
      : `Payment sent: ${payload.paymentNumber}`;
  }

  private buildBody(payload: PaymentConfirmedEventPayload): string {
    return `Payment ${payload.paymentNumber} for ${payload.amount} ${payload.currency} has been confirmed.`;
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
