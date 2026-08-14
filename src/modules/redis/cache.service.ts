import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis-client.provider';

/**
 * Thin cache-only abstraction over the shared ioredis client (Phase 19,
 * locked scope). No business logic lives here — callers own their own key
 * naming (convention: `erp:cache:<domain>:<key>`, company-prefixed
 * wherever the cached data is company-scoped) and their own TTL choice.
 *
 * Every method swallows Redis errors and falls back to a safe default
 * (undefined/false/-2) after logging a warning — a Redis outage must never
 * fail a request, only make it slower by forcing a cache miss. Callers
 * that need "fall through to MySQL on miss or error" get that for free by
 * treating `get()` returning undefined as a cache miss, exactly like a
 * real miss.
 *
 * Never exposes the raw ioredis client to business services — this is the
 * only supported surface for caching anywhere in the codebase.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | undefined> {
    try {
      const raw = await this.redis.get(key);
      if (raw === null) {
        return undefined;
      }
      return JSON.parse(raw) as T;
    } catch (error) {
      this.logger.warn(
        `Cache GET failed for key "${key}" — falling back to source: ${(error as Error).message}`,
      );
      return undefined;
    }
  }

  /** @param ttlSeconds Positive integer TTL in seconds. Required — this service never sets a key without an expiry. */
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      this.logger.warn(
        `Cache SET failed for key "${key}": ${(error as Error).message}`,
      );
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.warn(
        `Cache DELETE failed for key "${key}": ${(error as Error).message}`,
      );
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const count = await this.redis.exists(key);
      return count > 0;
    } catch (error) {
      this.logger.warn(
        `Cache EXISTS failed for key "${key}": ${(error as Error).message}`,
      );
      return false;
    }
  }

  /** @returns TTL in seconds, -2 if the key doesn't exist, -1 if it exists with no expiry, or -2 on Redis error (treated the same as "not cached"). */
  async ttl(key: string): Promise<number> {
    try {
      return await this.redis.ttl(key);
    } catch (error) {
      this.logger.warn(
        `Cache TTL failed for key "${key}": ${(error as Error).message}`,
      );
      return -2;
    }
  }

  /** Used by the Redis health check — a real (cheap) connectivity probe, never assumed. */
  async isConnected(): Promise<boolean> {
    try {
      const pong = await this.redis.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }
}
