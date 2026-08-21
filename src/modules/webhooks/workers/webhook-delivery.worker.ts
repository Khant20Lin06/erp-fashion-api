import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import Redis from 'ioredis';
import { Repository } from 'typeorm';
import { BaseQueueWorker } from '../../queue/base-queue-worker';
import { QueueNames } from '../../queue/queue-names';
import { BULLMQ_CONNECTION } from '../../queue/bullmq-connection.provider';
import { WebhookDeliveryJobData } from './webhook-delivery-job.interface';
import { WebhookDelivery } from '../entities/webhook-delivery.entity';
import { WebhookDeliveryStatus } from '../entities/webhook-delivery-status.enum';
import { WebhookSubscription } from '../entities/webhook-subscription.entity';
import { postSignedWebhook } from '../utils/webhook-http';
import { QueueConfig } from '../../../config/queue.config';
import { MetricsRegistryService } from '../../../observability/metrics/metrics-registry.service';

/**
 * Delivers one webhook HTTP POST per job (Phase 23). Extends
 * BaseQueueWorker exactly like NotificationWorker — retry/backoff comes
 * entirely from BullMQ's own bounded 5-attempt exponential-backoff policy
 * configured once at QueueService.enqueue() time (DEFAULT_JOB_OPTIONS:
 * attempts=5, backoff 2000ms exponential), not reinvented here.
 *
 * HARD BOUNDARY (same as every other worker in this codebase): never
 * writes to Payment/Sale/Inventory/JournalEntry tables — only reads the
 * WebhookDelivery/WebhookSubscription rows it owns and writes back to
 * WebhookDelivery. A delivery failure (including retry exhaustion) can
 * never roll back or affect the domain transaction that produced the
 * source event — this worker runs entirely after that transaction has
 * already committed (Outbox -> Kafka -> here).
 *
 * Idempotency: re-reads the WebhookDelivery row by id (never trusts job
 * payload beyond the id) and skips immediately if status is already
 * DELIVERED — a re-delivered/duplicate BullMQ job for an already-succeeded
 * delivery is a safe no-op.
 */
@Injectable()
export class WebhookDeliveryWorker extends BaseQueueWorker<WebhookDeliveryJobData> {
  constructor(
    @Inject(BULLMQ_CONNECTION) connection: Redis,
    configService: ConfigService,
    @InjectRepository(WebhookDelivery)
    private readonly deliveryRepository: Repository<WebhookDelivery>,
    @InjectRepository(WebhookSubscription)
    private readonly subscriptionRepository: Repository<WebhookSubscription>,
    @Optional() metrics?: MetricsRegistryService,
  ) {
    super(
      QueueNames.WEBHOOK_DELIVERY,
      connection,
      configService.get<QueueConfig>('queue')!.webhookWorkerConcurrency,
      metrics,
    );
  }

  protected async process(job: Job<WebhookDeliveryJobData>): Promise<void> {
    const delivery = await this.deliveryRepository.findOne({
      where: { id: job.data.webhookDeliveryId },
    });
    if (!delivery) {
      this.logger.warn(
        `WebhookDelivery ${job.data.webhookDeliveryId} not found — skipping`,
      );
      return;
    }
    if (delivery.status === WebhookDeliveryStatus.Delivered) {
      return;
    }

    const subscription = await this.subscriptionRepository.findOne({
      where: { id: delivery.webhookSubscriptionId },
    });
    if (!subscription) {
      await this.deliveryRepository.update(delivery.id, {
        status: WebhookDeliveryStatus.Failed,
        attempt: job.attemptsMade + 1,
        errorMessage: 'Webhook subscription no longer exists',
      });
      return;
    }
    if (!subscription.isActive) {
      // Subscription was deactivated after dispatch but before delivery —
      // honor the current state, never send to a now-inactive endpoint.
      await this.deliveryRepository.update(delivery.id, {
        status: WebhookDeliveryStatus.Failed,
        attempt: job.attemptsMade + 1,
        errorMessage: 'Webhook subscription is inactive',
      });
      return;
    }

    const rawBody = JSON.stringify({
      id: delivery.eventId,
      type: delivery.eventType,
      occurredAt: new Date().toISOString(),
      companyId: subscription.companyId,
    });

    const attemptNumber = job.attemptsMade + 1;

    try {
      const result = await postSignedWebhook(
        subscription.url,
        subscription.secret,
        rawBody,
      );

      if (result.status >= 200 && result.status < 300) {
        await this.deliveryRepository.update(delivery.id, {
          status: WebhookDeliveryStatus.Delivered,
          attempt: attemptNumber,
          responseStatus: result.status,
          responseBody: result.body,
          errorMessage: null,
          deliveredAt: new Date(),
        });
        await this.subscriptionRepository.update(subscription.id, {
          lastDeliveredAt: new Date(),
          failureCount: 0,
        });
        return;
      }

      // Non-2xx: record the attempt, then throw so BullMQ retries (or
      // exhausts, at which point the catch branch below persists the
      // final FAILED state).
      await this.deliveryRepository.update(delivery.id, {
        status: WebhookDeliveryStatus.Pending,
        attempt: attemptNumber,
        responseStatus: result.status,
        responseBody: result.body,
        errorMessage: `Receiver returned HTTP ${result.status}`,
      });
      throw new Error(`Webhook receiver returned HTTP ${result.status}`);
    } catch (error) {
      const isLastAttempt = attemptNumber >= (job.opts.attempts ?? 1);
      await this.deliveryRepository.update(delivery.id, {
        status: isLastAttempt
          ? WebhookDeliveryStatus.Failed
          : WebhookDeliveryStatus.Pending,
        attempt: attemptNumber,
        errorMessage: (error as Error).message.slice(0, 1000),
      });
      if (isLastAttempt) {
        await this.subscriptionRepository.increment(
          { id: subscription.id },
          'failureCount',
          1,
        );
      }
      throw error;
    }
  }
}
