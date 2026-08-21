import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { KafkaConsumerService } from '../../kafka/kafka-consumer.service';
import { KafkaConsumedMessage } from '../../kafka/kafka-consumer.interface';
import { ProcessedEvent } from '../../outbox/entities/processed-event.entity';
import { PAYMENT_EVENTS_TOPIC } from '../../outbox/outbox-topics';
import type { EventEnvelope } from '../../outbox/interfaces/event-envelope.interface';
import { WebhookDelivery } from '../entities/webhook-delivery.entity';
import { WebhookSubscriptionsService } from '../services/webhook-subscriptions.service';
import { QueueService } from '../../queue/queue.service';
import { QueueNames } from '../../queue/queue-names';
import { DELIVER_WEBHOOK_JOB } from '../workers/webhook-delivery-job.interface';
import { SUPPORTED_WEBHOOK_EVENT_TYPES } from '../webhook-event-types';
import {
  isOpenApiGenerationMode,
  isWorkerRuntimeRole,
} from '../../../shared/utils/runtime-flags';

/** Fixed, meaningful consumer group id — a SEPARATE group from erp-notification-consumer/erp-payment-audit-consumer, so all three independently receive every message. */
export const WEBHOOK_DISPATCH_CONSUMER_NAME = 'erp-webhook-dispatch-consumer';

/**
 * Phase 23's consumer of the EXISTING erp.payment.events topic — no new
 * Kafka topic, no change to PaymentsService or the Outbox producer path.
 * Mirrors NotificationEventConsumer's exact structure and idempotency
 * pattern (processed_events check BEFORE any side effect, insert AFTER,
 * ER_DUP_ENTRY/errno-1062 caught as a race backstop).
 *
 * Company isolation (LOCKED, phase's own explicit rule): the company whose
 * webhooks receive this event is ALWAYS envelope.companyId — the real
 * source event's own tenancy field, resolved server-side by
 * OutboxService/PaymentsService at emission time. Nothing here ever reads
 * a company id from client input.
 *
 * This consumer's job is deliberately narrow and fast (locked spec): for
 * each active subscription matching (companyId, eventType), create one
 * WebhookDelivery row (idempotent via UNIQUE(webhook_subscription_id,
 * event_id)) and enqueue one BullMQ delivery job carrying only ids — never
 * the full payload or the subscription's secret — mirroring
 * NotificationEventConsumer's own "job carries an id, worker re-reads"
 * discipline exactly.
 */
@Injectable()
export class WebhookDispatchConsumer implements OnModuleInit {
  private readonly logger = new Logger(WebhookDispatchConsumer.name);

  constructor(
    private readonly kafkaConsumerService: KafkaConsumerService,
    private readonly dataSource: DataSource,
    private readonly webhookSubscriptionsService: WebhookSubscriptionsService,
    private readonly queueService: QueueService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (isOpenApiGenerationMode() || !isWorkerRuntimeRole()) {
      return;
    }

    await this.kafkaConsumerService.run(
      WEBHOOK_DISPATCH_CONSUMER_NAME,
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

    if (
      !(SUPPORTED_WEBHOOK_EVENT_TYPES as readonly string[]).includes(
        envelope.eventType,
      )
    ) {
      // Forward-compatible: a future eventType on this same topic that no
      // subscription can be filtered against yet is skipped, not an error.
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
          consumerName: WEBHOOK_DISPATCH_CONSUMER_NAME,
        },
      });

    if (alreadyProcessed) {
      this.logger.log(
        `Skipping already-processed event ${envelope.eventId} (duplicate delivery to ${WEBHOOK_DISPATCH_CONSUMER_NAME})`,
      );
      return;
    }

    const subscriptions =
      await this.webhookSubscriptionsService.findActiveForEvent(
        envelope.companyId,
        envelope.eventType,
      );

    for (const subscription of subscriptions) {
      const deliveryRepository = this.dataSource.getRepository(WebhookDelivery);

      let delivery = await deliveryRepository.findOne({
        where: {
          webhookSubscriptionId: subscription.id,
          eventId: envelope.eventId,
        },
      });

      if (!delivery) {
        try {
          delivery = await deliveryRepository.save(
            deliveryRepository.create({
              webhookSubscriptionId: subscription.id,
              eventId: envelope.eventId,
              eventType: envelope.eventType,
            }),
          );
        } catch (error) {
          if (!this.isDuplicateKeyError(error)) {
            throw error;
          }
          // Concurrent redelivery race: the row now exists — re-fetch it.
          delivery = await deliveryRepository.findOneOrFail({
            where: {
              webhookSubscriptionId: subscription.id,
              eventId: envelope.eventId,
            },
          });
        }
      }

      try {
        await this.queueService.enqueue(
          QueueNames.WEBHOOK_DELIVERY,
          DELIVER_WEBHOOK_JOB,
          {
            webhookDeliveryId: delivery.id,
            correlationId: envelope.correlationId,
          },
          { jobId: `webhook-delivery-${delivery.id}` },
        );
      } catch (error) {
        this.logger.error(
          `Failed to enqueue webhook delivery job for delivery ${delivery.id} (event ${envelope.eventId}): ${(error as Error).message}`,
        );
        throw error;
      }
    }

    try {
      await this.dataSource.getRepository(ProcessedEvent).insert({
        eventId: envelope.eventId,
        consumerName: WEBHOOK_DISPATCH_CONSUMER_NAME,
        processedAt: new Date(),
      });
    } catch (error) {
      if (!this.isDuplicateKeyError(error)) {
        throw error;
      }
      this.logger.log(
        `Concurrent redelivery detected for event ${envelope.eventId} — processed_events row already exists`,
      );
    }
  }

  private isDuplicateKeyError(error: unknown): boolean {
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
