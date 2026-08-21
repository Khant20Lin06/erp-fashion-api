import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { OrganizationModule } from '../organization/organization.module';
import { ProcessedEvent } from '../outbox/entities/processed-event.entity';
import { WebhookSubscription } from './entities/webhook-subscription.entity';
import { WebhookDelivery } from './entities/webhook-delivery.entity';
import { WebhookSubscriptionsService } from './services/webhook-subscriptions.service';
import { WebhookDeliveriesService } from './services/webhook-deliveries.service';
import { WebhookSubscriptionsController } from './controllers/webhook-subscriptions.controller';
import { WebhookDeliveriesController } from './controllers/webhook-deliveries.controller';
import { WebhookDispatchConsumer } from './consumers/webhook-dispatch.consumer';
import { WebhookDeliveryWorker } from './workers/webhook-delivery.worker';

/**
 * Phase 23 — Integrations/Webhooks. Depends on OrganizationModule
 * (Company) exactly like every other master-data module; KafkaModule/
 * QueueModule/RedisModule are all @Global (same as NotificationsModule
 * relies on) so no explicit import is needed for
 * KafkaConsumerService/QueueService.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      WebhookSubscription,
      WebhookDelivery,
      ProcessedEvent,
    ]),
    AuthModule,
    RbacModule,
    OrganizationModule,
  ],
  providers: [
    WebhookSubscriptionsService,
    WebhookDeliveriesService,
    WebhookDispatchConsumer,
    WebhookDeliveryWorker,
  ],
  controllers: [WebhookSubscriptionsController, WebhookDeliveriesController],
  exports: [WebhookSubscriptionsService],
})
export class WebhooksModule {}
