import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis-client.provider';
import { MetricsRegistryService } from '../../observability/metrics/metrics-registry.service';

/**
 * Thin cache-only abstraction over the shared ioredis client (Phase 19,
 * locked scope). No business logic lives here - callers own their own key
 * naming (convention: `erp:cache:<domain>:<key>`, company-prefixed
 * wherever the cached data is company-scoped) and their own TTL choice.
 *
 * Every method swallows Redis errors and falls back to a safe default
 * (undefined/false/-2) after logging a warning - a Redis outage must never
 * fail a request, only make it slower by forcing a cache miss. Callers
 * that need "fall through to MySQL on miss or error" get that for free by
 * treating `get()` returning undefined as a cache miss, exactly like a
 * real miss.
 *
 * Never exposes the raw ioredis client to business services - this is the
 * only supported surface for caching anywhere in the codebase.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Optional() private readonly metrics?: MetricsRegistryService,
  ) {}

  async get<T>(key: string): Promise<T | undefined> {
    const startedAt = Date.now();

    try {
      const raw = await this.redis.get(key);
      if (raw === null) {
        this.metrics?.recordRedisOperation(
          'get',
          'miss',
          Date.now() - startedAt,
        );
        return undefined;
      }

      this.metrics?.recordRedisOperation('get', 'hit', Date.now() - startedAt);
      return JSON.parse(raw) as T;
    } catch (error) {
      this.logger.warn(
        `Cache GET failed for key "${key}" - falling back to source: ${(error as Error).message}`,
      );
      this.metrics?.recordRedisOperation(
        'get',
        'error',
        Date.now() - startedAt,
      );
      return undefined;
    }
  }

  /** @param ttlSeconds Positive integer TTL in seconds. Required - this service never sets a key without an expiry. */
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const startedAt = Date.now();

    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      this.metrics?.recordRedisOperation(
        'set',
        'success',
        Date.now() - startedAt,
      );
    } catch (error) {
      this.logger.warn(
        `Cache SET failed for key "${key}": ${(error as Error).message}`,
      );
      this.metrics?.recordRedisOperation(
        'set',
        'error',
        Date.now() - startedAt,
      );
    }
  }

  /**
   * Small shared primitive for rate-limiting and similar bounded counters.
   * Returns the incremented count, or undefined if Redis is unavailable.
   */
  async increment(
    key: string,
    ttlSeconds: number,
  ): Promise<number | undefined> {
    const startedAt = Date.now();

    try {
      const count = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.expire(key, ttlSeconds);
      }
      this.metrics?.recordRedisOperation(
        'increment',
        'success',
        Date.now() - startedAt,
      );
      return count;
    } catch (error) {
      this.logger.warn(
        `Cache INCR failed for key "${key}": ${(error as Error).message}`,
      );
      this.metrics?.recordRedisOperation(
        'increment',
        'error',
        Date.now() - startedAt,
      );
      return undefined;
    }
  }

  async delete(key: string): Promise<void> {
    const startedAt = Date.now();

    try {
      await this.redis.del(key);
      this.metrics?.recordRedisOperation(
        'delete',
        'success',
        Date.now() - startedAt,
      );
    } catch (error) {
      this.logger.warn(
        `Cache DELETE failed for key "${key}": ${(error as Error).message}`,
      );
      this.metrics?.recordRedisOperation(
        'delete',
        'error',
        Date.now() - startedAt,
      );
    }
  }

  async exists(key: string): Promise<boolean> {
    const startedAt = Date.now();

    try {
      const count = await this.redis.exists(key);
      this.metrics?.recordRedisOperation(
        'exists',
        count > 0 ? 'hit' : 'miss',
        Date.now() - startedAt,
      );
      return count > 0;
    } catch (error) {
      this.logger.warn(
        `Cache EXISTS failed for key "${key}": ${(error as Error).message}`,
      );
      this.metrics?.recordRedisOperation(
        'exists',
        'error',
        Date.now() - startedAt,
      );
      return false;
    }
  }

  /** @returns TTL in seconds, -2 if the key doesn't exist, -1 if it exists with no expiry, or -2 on Redis error (treated the same as "not cached"). */
  async ttl(key: string): Promise<number> {
    const startedAt = Date.now();

    try {
      const ttl = await this.redis.ttl(key);
      this.metrics?.recordRedisOperation(
        'ttl',
        ttl >= 0 ? 'success' : 'miss',
        Date.now() - startedAt,
      );
      return ttl;
    } catch (error) {
      this.logger.warn(
        `Cache TTL failed for key "${key}": ${(error as Error).message}`,
      );
      this.metrics?.recordRedisOperation(
        'ttl',
        'error',
        Date.now() - startedAt,
      );
      return -2;
    }
  }

  /** Used by the Redis health check - a real (cheap) connectivity probe, never assumed. */
  async isConnected(): Promise<boolean> {
    try {
      const pong = await this.redis.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }
}
