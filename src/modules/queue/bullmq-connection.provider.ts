import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisConfig } from '../../config/redis.config';

export const BULLMQ_CONNECTION = Symbol('BULLMQ_CONNECTION');

const logger = new Logger('BullMqConnection');

/**
 * BullMQ's own connection (Phase 20, locked decision: reuse the same
 * REDIS_HOST/PORT/PASSWORD/DB config as Phase 19's CacheService, don't
 * introduce a second Redis config surface). This is a SEPARATE ioredis
 * client instance from RedisModule's own — not the same object — because
 * BullMQ requires `maxRetriesPerRequest: null` and `enableReadyCheck` tuned
 * for its own blocking-command usage (BRPOPLPUSH-style polling internally),
 * which conflicts with CacheService's client
 * (`maxRetriesPerRequest: 1`/`enableOfflineQueue: false`, tuned for fast
 * fail-through-to-MySQL instead). Same target Redis server, same config
 * values, deliberately different client options — see BullMQ's own docs on
 * why `maxRetriesPerRequest: null` is mandatory for Queue/Worker connections.
 */
export function createBullMqConnection(configService: ConfigService): Redis {
  const redisConfig = configService.get<RedisConfig>('redis')!;

  const client = new Redis({
    host: redisConfig.host,
    port: redisConfig.port,
    password: redisConfig.password,
    db: redisConfig.db,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });

  client.on('error', (error: Error) => {
    // A Redis/BullMQ outage must never crash the API process — background
    // job processing is best-effort infrastructure, never on the path of a
    // business transaction (locked spec: BullMQ is job execution only).
    logger.warn(`BullMQ Redis connection error: ${error.message}`);
  });

  return client;
}
