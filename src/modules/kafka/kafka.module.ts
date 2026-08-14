import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KAFKA_CLIENT, createKafkaClient } from './kafka-client.provider';
import { KafkaProducerService } from './kafka-producer.service';
import { KafkaConsumerService } from './kafka-consumer.service';

/**
 * Owns the Kafka client config, producer, and consumer registration (Phase
 * 18, locked module boundary). Domain services never touch Kafka directly —
 * only OutboxService/OutboxPublisher (producer side) and consumer-side
 * infra (e.g. PaymentEventConsumer) reference this module's exports.
 *
 * @Global so OutboxModule and any future consumer module can inject
 * KafkaProducerService/KafkaConsumerService without every intermediate
 * module having to re-import KafkaModule explicitly — the same pattern
 * TransactionModule already uses in this codebase for a cross-cutting
 * infrastructure concern.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: KAFKA_CLIENT,
      inject: [ConfigService],
      useFactory: createKafkaClient,
    },
    KafkaProducerService,
    KafkaConsumerService,
  ],
  exports: [KafkaProducerService, KafkaConsumerService],
})
export class KafkaModule {}
