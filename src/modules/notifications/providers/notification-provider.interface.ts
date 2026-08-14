import { Notification } from '../entities/notification.entity';
import { NotificationChannel } from '../entities/notification-channel.enum';

/**
 * A "channel" is anything that can deliver an already-persisted
 * Notification row. Exactly one implementation exists in this codebase —
 * InAppNotificationProvider — since no external email/SMS/push
 * credentials or config exist anywhere in this repo (Phase 21, locked
 * scope). This interface exists now so NotificationWorker's own logic
 * never hardcodes "in-app" — a future real external channel implements
 * this same contract and is selected the same way (by
 * Notification.channel), no worker rewrite required.
 */
export interface NotificationProvider {
  readonly channel: NotificationChannel;

  /** Delivers the notification. Throwing marks the job failed (NotificationWorker records lastError/failedAt and lets BullMQ retry per its own bounded backoff). */
  deliver(notification: Notification): Promise<void>;
}

export const NOTIFICATION_PROVIDERS = Symbol('NOTIFICATION_PROVIDERS');
