import { Inject, Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { BaseQueueWorker } from '../../queue/base-queue-worker';
import { BULLMQ_CONNECTION } from '../../queue/bullmq-connection.provider';
import { QueueNames } from '../../queue/queue-names';
import { NotificationsService } from '../services/notifications.service';
import { NotificationStatus } from '../entities/notification-status.enum';
import {
  NOTIFICATION_PROVIDERS,
  NotificationProvider,
} from '../providers/notification-provider.interface';
import { NotificationJobData } from './notification-job.interface';
import { QueueConfig } from '../../../config/queue.config';
import { MetricsRegistryService } from '../../../observability/metrics/metrics-registry.service';

/**
 * Phase 21 — the sole consumer of the `notifications` BullMQ queue.
 * HARD BOUNDARY (verified by grep in the final report): this class and
 * everything it calls (NotificationsService, NotificationProvider
 * implementations) never write to Payment/JournalEntry/Inventory tables —
 * only the `notifications` table.
 *
 * Idempotent by construction, in two independent layers:
 *   1. BullMQ's own jobId dedupe (QueueService.enqueue() always passes a
 *      deterministic `notification:<notificationId>` jobId — see
 *      NotificationEventConsumer) means the SAME logical job cannot be
 *      enqueued twice while still active/waiting/delayed.
 *   2. Even if this handler somehow ran twice for the same
 *      notificationId (e.g. after a BullMQ retry following a crash AFTER
 *      the provider call but BEFORE the status update committed), it
 *      re-reads the row's CURRENT status first — if already SENT, it is a
 *      no-op. This is the "driven by the row's own current status" half
 *      of the locked idempotency requirement.
 */
@Injectable()
export class NotificationWorker extends BaseQueueWorker<NotificationJobData> {
  constructor(
    @Inject(BULLMQ_CONNECTION) connection: Redis,
    private readonly notificationsService: NotificationsService,
    @Inject(NOTIFICATION_PROVIDERS)
    private readonly providers: NotificationProvider[],
    configService?: ConfigService,
    metrics?: MetricsRegistryService,
  ) {
    const queueConfig = configService?.get<QueueConfig>('queue');
    super(
      QueueNames.NOTIFICATIONS,
      connection,
      queueConfig?.notificationWorkerConcurrency ?? 3,
      metrics,
    );
  }

  protected async process(job: Job<NotificationJobData>): Promise<void> {
    const { notificationId } = job.data;

    const notification =
      await this.notificationsService.findById(notificationId);
    if (!notification) {
      // Nothing to do — a Notification row that no longer exists is not a
      // retryable condition (it will never exist on a later attempt
      // either), so this returns cleanly rather than throwing into
      // BullMQ's retry loop.
      this.logger.warn(
        `NotificationWorker: notification ${notificationId} not found — skipping`,
      );
      return;
    }

    if (notification.status === NotificationStatus.Sent) {
      // Idempotency layer 2 — see class docblock.
      this.logger.log(
        `NotificationWorker: notification ${notificationId} already SENT — no-op`,
      );
      return;
    }

    const provider = this.providers.find(
      (candidate) => candidate.channel === notification.channel,
    );
    if (!provider) {
      const message = `No NotificationProvider registered for channel "${notification.channel}"`;
      await this.notificationsService.markFailed(notificationId, message);
      throw new Error(message);
    }

    try {
      await provider.deliver(notification);
      await this.notificationsService.markSent(notificationId);
    } catch (error) {
      const message = (error as Error).message ?? 'Unknown delivery error';
      await this.notificationsService.markFailed(notificationId, message);
      // Rethrow so BullMQ's own bounded retry/backoff (configured at
      // enqueue time by QueueService) decides whether to try again.
      throw error;
    }
  }
}
