import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisConfig } from '../../config/redis.config';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

const logger = new Logger('RedisClient');

/**
 * Builds the single shared ioredis client instance for this process
 * (Phase 19, locked scope: Redis is cache-only infrastructure, never a
 * source of truth). Connection settings are read exclusively through
 * ConfigService (RedisConfig, itself sourced from REDIS_HOST/REDIS_PORT/
 * REDIS_PASSWORD/REDIS_DB env vars) — never hardcoded, mirroring
 * kafka-client.provider.ts's own pattern.
 *
 * `lazyConnect: false` lets ioredis start connecting immediately in the
 * background with its own built-in retry strategy; `maxRetriesPerRequest`
 * is capped low so a command issued while Redis is unreachable fails fast
 * instead of queuing indefinitely — CacheService wraps every call in a
 * try/catch and falls back to MySQL, so a fast, bounded failure is exactly
 * what that fallback needs. `enableOfflineQueue: false` means commands
 * issued while disconnected reject immediately rather than buffering,
 * which would otherwise cause them to pile up and eventually fail together
 * much later.
 *
 * This same client is also the Phase 20 BullMQ connection (locked
 * decision: reuse the one Redis connection config, don't create a second
 * client). BullMQ requires `maxRetriesPerRequest: null` on ITS OWN
 * connection, so QueueModule creates a second lightweight ioredis instance
 * from the same RedisConfig rather than sharing this exact client — see
 * queue.module.ts for that rationale.
 */
export function createRedisClient(configService: ConfigService): Redis {
  const redisConfig = configService.get<RedisConfig>('redis')!;

  const client = new Redis({
    host: redisConfig.host,
    port: redisConfig.port,
    password: redisConfig.password,
    db: redisConfig.db,
    lazyConnect: false,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: (times: number) => Math.min(times * 200, 5000),
  });

  client.on('error', (error: Error) => {
    // A Redis outage must never crash the API process (locked spec: cache
    // reads/writes fall back to MySQL transparently). ioredis emits 'error'
    // repeatedly while it retries in the background — log at warn, not
    // error, to avoid flooding structured logs during a real outage.
    logger.warn(`Redis client error: ${error.message}`);
  });

  return client;
}
