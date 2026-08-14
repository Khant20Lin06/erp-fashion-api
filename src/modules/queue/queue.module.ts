import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  BULLMQ_CONNECTION,
  createBullMqConnection,
} from './bullmq-connection.provider';
import { QueueService } from './queue.service';

/**
 * Owns the shared BullMQ Redis connection and the QueueService producer
 * abstraction over it (Phase 20, locked module boundary — BullMQ is
 * background-job execution only, never a second event broker, never used
 * for the transactional Outbox path). Domain/consumer services never touch
 * a raw BullMQ Queue/connection — they only ever inject QueueService.
 *
 * Worker process architecture (locked decision, justified here): this
 * project's own established pattern for infrastructure wrappers
 * (KafkaProducerService/KafkaConsumerService wrapping kafkajs directly
 * rather than @nestjs/microservices) and its explicit
 * "don't introduce infrastructure complexity without evidence" style both
 * point the same direction — @nestjs/bullmq's decorator-based
 * @Processor()/@Worker() abstraction would be a second, competing DI
 * paradigm for background work alongside the existing thin-wrapper
 * pattern, and nothing in this codebase's docker-compose or deployment
 * setup (single `api` service, no worker/queue-consumer service anywhere)
 * suggests a separate worker process was ever provisioned for. Workers
 * therefore run in-process, as plain injectable classes extending
 * BaseQueueWorker, registered as providers in their OWN domain module
 * (e.g. NotificationWorker lives in the notifications module, not here) —
 * QueueModule only owns the shared connection/producer, exactly like
 * KafkaModule only owns the shared client/producer/consumer-registrar
 * while PaymentEventConsumer itself lives in the payments module.
 *
 * @Global so any module can inject QueueService without every intermediate
 * module re-importing QueueModule explicitly.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: BULLMQ_CONNECTION,
      inject: [ConfigService],
      useFactory: createBullMqConnection,
    },
    QueueService,
  ],
  exports: [QueueService, BULLMQ_CONNECTION],
})
export class QueueModule {}
