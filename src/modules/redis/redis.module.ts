import { Global, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Inject } from '@nestjs/common';
import { REDIS_CLIENT, createRedisClient } from './redis-client.provider';
import { CacheService } from './cache.service';

/**
 * Owns the shared ioredis client and the CacheService abstraction over it
 * (Phase 19, locked module boundary — Redis is cache/infrastructure only,
 * never authoritative for anything). Domain services never touch ioredis
 * directly — they only ever inject CacheService.
 *
 * @Global so any module can inject CacheService without every intermediate
 * module having to re-import RedisModule explicitly — the same pattern
 * KafkaModule/TransactionModule already use in this codebase for
 * cross-cutting infrastructure concerns.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: createRedisClient,
    },
    CacheService,
  ],
  // Only CacheService is exported — the raw ioredis client (REDIS_CLIENT)
  // stays private to this module. Business services must never see the raw
  // client; this module's own onModuleDestroy() below is the sole other
  // consumer, and it lives inside this module so it can inject it directly.
  exports: [CacheService],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }
}
