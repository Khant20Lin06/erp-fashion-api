import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Consumer, Kafka } from 'kafkajs';
import { KAFKA_CLIENT } from './kafka-client.provider';
import { KafkaMessageHandler } from './kafka-consumer.interface';

/**
 * Thin wrapper around kafkajs consumer-group registration (Phase 18, D3/D5).
 * Each call to `run()` creates and starts its own kafkajs Consumer bound to
 * a fixed, meaningful consumer group id (never a random/per-process id —
 * locked spec requirement) so that group offsets are durable across
 * restarts and multiple instances of this service load-balance the same
 * topic's partitions rather than each seeing every message.
 *
 * This wrapper does not implement retry/backoff/DLQ logic itself — that is
 * each individual consumer's responsibility (see PaymentEventConsumer's own
 * docblock for why the audit consumer's handler is written to never throw
 * for a business-level failure, only for genuine infra errors that should
 * legitimately block offset commit and cause redelivery).
 */
@Injectable()
export class KafkaConsumerService implements OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private readonly consumers: Consumer[] = [];

  constructor(@Inject(KAFKA_CLIENT) private readonly kafka: Kafka) {}

  async run(
    groupId: string,
    topics: string[],
    handler: KafkaMessageHandler,
  ): Promise<void> {
    const consumer = this.kafka.consumer({ groupId });
    this.consumers.push(consumer);

    await consumer.connect();
    await consumer.subscribe({ topics, fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        await handler({
          topic,
          partition,
          key: message.key ? message.key.toString() : null,
          value: message.value ? message.value.toString() : null,
        });
      },
    });

    this.logger.log(
      `Kafka consumer started: group=${groupId} topics=${topics.join(',')}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(
      this.consumers.map((consumer) =>
        consumer.disconnect().catch(() => undefined),
      ),
    );
  }
}
