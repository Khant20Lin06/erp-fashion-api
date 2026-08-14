import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/app.config';
import { KafkaProducerService } from '../modules/kafka/kafka-producer.service';
import { CacheService } from '../modules/redis/cache.service';

interface HealthResponse {
  status: 'ok';
  service: string;
  environment: string;
  timestamp: string;
  kafka: 'up' | 'down';
  redis: 'up' | 'down';
}

/**
 * The Kafka connectivity check (Phase 18 addition) is purely informational
 * — `status` at the top level is always 'ok' regardless of Kafka's state.
 * This process's core business operations (Payment/Sale/etc.) never depend
 * on Kafka being reachable (locked spec: "Kafka being down must never fail
 * a business operation"), so this endpoint must never report an overall
 * failure, or be used as a readiness gate, purely because Kafka is
 * unreachable. `kafka: 'down'` is a real, awaited connectivity probe (see
 * KafkaProducerService.isConnected()), not an assumption.
 *
 * The Redis connectivity check (Phase 19 addition) follows the exact same
 * pattern: purely informational, never affects top-level `status`, since
 * Redis is cache-only infrastructure and every cached read already falls
 * back to MySQL transparently on any Redis error (CacheService's own
 * contract). `redis: 'down'` is a real, awaited PING probe (see
 * CacheService.isConnected()), not an assumption.
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly configService: ConfigService,
    private readonly kafkaProducerService: KafkaProducerService,
    private readonly cacheService: CacheService,
  ) {}

  @Get()
  async check(): Promise<HealthResponse> {
    const appConfig = this.configService.get<AppConfig>('app')!;
    const kafkaConnected = await this.kafkaProducerService.isConnected();
    const redisConnected = await this.cacheService.isConnected();

    return {
      status: 'ok',
      service: 'fashion-erp-backend',
      environment: appConfig.nodeEnv,
      timestamp: new Date().toISOString(),
      kafka: kafkaConnected ? 'up' : 'down',
      redis: redisConnected ? 'up' : 'down',
    };
  }
}
