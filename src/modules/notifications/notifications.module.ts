import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { ProcessedEvent } from '../outbox/entities/processed-event.entity';
import { NotificationsService } from './services/notifications.service';
import { NotificationsController } from './controllers/notifications.controller';
import { NotificationEventConsumer } from './consumers/notification-event.consumer';
import { NotificationWorker } from './workers/notification.worker';
import { InAppNotificationProvider } from './providers/in-app-notification.provider';
import { NOTIFICATION_PROVIDERS } from './providers/notification-provider.interface';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';

/**
 * Phase 21 — Notifications. A single flat module, consistent with
 * Payments'/Inventory's own shape. KafkaModule/OutboxModule/QueueModule/
 * RedisModule are all @Global() so they do not need explicit imports here
 * (mirrors PaymentEventConsumerModule's own reasoning). Wires
 * NotificationEventConsumer (starts a Kafka consumer on module init) and
 * NotificationWorker (starts a BullMQ worker on module init) here, alongside
 * the read API — this whole pipeline is a single Notification-domain
 * concern, matching how PaymentsModule wires PaymentEventConsumerModule
 * even though it runs independently of any HTTP request.
 *
 * NOTIFICATION_PROVIDERS is bound to an array containing every concrete
 * NotificationProvider (exactly one today: InAppNotificationProvider) —
 * NotificationWorker selects the matching one by `channel` at dispatch
 * time, so adding a future real external channel means adding it to this
 * array, never touching NotificationWorker's own logic.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, ProcessedEvent]),
    AuthModule,
    RbacModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    InAppNotificationProvider,
    {
      provide: NOTIFICATION_PROVIDERS,
      useFactory: (inApp: InAppNotificationProvider) => [inApp],
      inject: [InAppNotificationProvider],
    },
    NotificationEventConsumer,
    NotificationWorker,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
