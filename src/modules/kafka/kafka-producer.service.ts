import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  Optional,
  OnModuleInit,
} from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';
import { KAFKA_CLIENT } from './kafka-client.provider';
import {
  isOpenApiGenerationMode,
  isWorkerRuntimeRole,
} from '../../shared/utils/runtime-flags';
import { MetricsRegistryService } from '../../observability/metrics/metrics-registry.service';

export interface KafkaPublishRequest {
  topic: string;
  key: string;
  value: string;
  headers?: Record<string, string>;
}

/**
 * Thin wrapper around a single kafkajs Producer instance (Phase 18, D3
 * LOCKED: Kafka is transport-only, never called from inside a business
 * transaction — the ONLY callers of this service are OutboxPublisher, which
 * always publishes strictly after the business transaction has committed,
 * and the Kafka health check). Domain services (PaymentsService etc.) never
 * import or inject this service directly — they only ever call
 * OutboxService.create().
 *
 * connect() is idempotent (kafkajs's own Producer.connect() is safe to call
 * multiple times) and is invoked both eagerly on module init (so the first
 * publish isn't slowed by a cold connect) and defensively before every
 * publish batch — if the broker was down at boot and has since come back,
 * later publishes still succeed without requiring a process restart.
 */
@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private readonly producer: Producer;
  private connected = false;

  constructor(
    @Inject(KAFKA_CLIENT) private readonly kafka: Kafka,
    @Optional() private readonly metrics?: MetricsRegistryService,
  ) {
    this.producer = this.kafka.producer({ allowAutoTopicCreation: true });
  }

  async onModuleInit(): Promise<void> {
    if (isOpenApiGenerationMode() || !isWorkerRuntimeRole()) {
      return;
    }

    try {
      await this.producer.connect();
      this.connected = true;
    } catch (error) {
      // Kafka being unavailable at boot must never crash the API process —
      // the business transaction (Payment/Sale/etc.) never depends on
      // Kafka being reachable (locked spec: "Kafka being down must never
      // fail a business operation"). OutboxPublisher's own publish calls
      // will keep retrying connect() below.
      this.logger.warn(
        `Kafka producer failed to connect on startup — will retry on next publish attempt: ${(error as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.connected) {
      await this.producer.disconnect().catch(() => undefined);
    }
  }

  private async ensureConnected(): Promise<void> {
    if (this.connected) {
      return;
    }
    await this.producer.connect();
    this.connected = true;
  }

  /**
   * Publishes a single message. Throws on failure — callers (OutboxPublisher)
   * are responsible for catching this and recording the failure on the
   * OutboxEvent row (attempt_count/last_error/backoff) rather than this
   * service silently swallowing errors.
   */
  async publish(request: KafkaPublishRequest): Promise<void> {
    const startedAt = Date.now();
    await this.ensureConnected();
    try {
      await this.producer.send({
        topic: request.topic,
        messages: [
          {
            key: request.key,
            value: request.value,
            headers: request.headers,
          },
        ],
      });
      this.metrics?.recordKafkaPublish(
        request.topic,
        'success',
        Date.now() - startedAt,
      );
    } catch (error) {
      this.metrics?.recordKafkaPublish(
        request.topic,
        'error',
        Date.now() - startedAt,
      );
      throw error;
    }
  }

  /** Used by the Kafka health check — a real (cheap) connectivity probe, never assumed. */
  async isConnected(): Promise<boolean> {
    try {
      await this.ensureConnected();
      return true;
    } catch {
      return false;
    }
  }
}
