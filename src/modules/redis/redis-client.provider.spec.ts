import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { createRedisClient } from './redis-client.provider';
import { RedisConfig } from '../../config/redis.config';

const redisConstructor = Redis as unknown as jest.Mock;

jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => ({
    on: jest.fn(),
  })),
);

describe('createRedisClient', () => {
  beforeEach(() => {
    redisConstructor.mockClear();
  });

  it('prefers REDIS_URL when present', () => {
    const redisConfig: RedisConfig = {
      url: 'redis://cache.example.com:6380/2',
      host: 'localhost',
      port: 6379,
      password: undefined,
      db: 0,
      connectTimeoutMs: 5000,
    };

    createRedisClient({
      get: jest.fn().mockReturnValue(redisConfig),
    } as unknown as ConfigService);

    expect(redisConstructor).toHaveBeenCalledWith(
      'redis://cache.example.com:6380/2',
      expect.objectContaining({
        connectTimeout: 5000,
        enableOfflineQueue: false,
      }),
    );
  });

  it('falls back to host/port config when REDIS_URL is absent', () => {
    const redisConfig: RedisConfig = {
      url: undefined,
      host: 'redis',
      port: 6380,
      password: 'secret',
      db: 2,
      connectTimeoutMs: 4000,
    };

    createRedisClient({
      get: jest.fn().mockReturnValue(redisConfig),
    } as unknown as ConfigService);

    expect(redisConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'redis',
        port: 6380,
        password: 'secret',
        db: 2,
        connectTimeout: 4000,
      }),
    );
  });
});
