import { Injectable, Logger } from '@nestjs/common';
import { Notification } from '../entities/notification.entity';
import { NotificationChannel } from '../entities/notification-channel.enum';
import { NotificationProvider } from './notification-provider.interface';

/**
 * The one real, working channel this phase ships (Phase 21, locked scope).
 * "Delivery" for IN_APP is simply the durable `notifications` row itself
 * becoming visible via GET /notifications — there is no external call to
 * make, so this provider's `deliver()` is a genuine no-op beyond a debug
 * log line. This is not a stub standing in for a future real provider's
 * behavior; it IS the real, complete behavior of the IN_APP channel.
 */
@Injectable()
export class InAppNotificationProvider implements NotificationProvider {
  readonly channel = NotificationChannel.InApp;
  private readonly logger = new Logger(InAppNotificationProvider.name);

  deliver(notification: Notification): Promise<void> {
    this.logger.debug(
      `IN_APP notification ${notification.id} delivered (durable row now visible via GET /notifications)`,
    );
    return Promise.resolve();
  }
}
