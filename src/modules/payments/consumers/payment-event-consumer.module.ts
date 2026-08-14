import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcessedEvent } from '../../outbox/entities/processed-event.entity';
import { PaymentEventConsumer } from './payment-event.consumer';

/**
 * Wires the one real Phase 18 consumer (PaymentEventConsumer, an audit
 * logger for payment.confirmed). KafkaModule is @Global(), so
 * KafkaConsumerService is available without an explicit import here.
 * Separate from PaymentsModule's own providers list so this consumer's
 * dependency surface (ProcessedEvent repository) stays scoped to exactly
 * what it needs.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ProcessedEvent])],
  providers: [PaymentEventConsumer],
})
export class PaymentEventConsumerModule {}
