import Redis from 'ioredis';
import { CacheService } from './cache.service';

describe('CacheService', () => {
  let service: CacheService;
  let redis: jest.Mocked<
    Pick<
      Redis,
      'get' | 'set' | 'del' | 'exists' | 'ttl' | 'ping' | 'incr' | 'expire'
    >
  >;

  beforeEach(() => {
    redis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      ttl: jest.fn(),
      ping: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
    };
    service = new CacheService(redis as unknown as Redis);
  });

  describe('get', () => {
    it('returns undefined on a real cache miss (null from Redis)', async () => {
      redis.get.mockResolvedValue(null);

      await expect(service.get('erp:cache:x:1')).resolves.toBeUndefined();
    });

    it('parses and returns the cached value on a hit', async () => {
      redis.get.mockResolvedValue(JSON.stringify({ a: 1 }));

      await expect(service.get('erp:cache:x:1')).resolves.toEqual({ a: 1 });
    });

    it('falls back to undefined (cache miss) when Redis throws — never propagates the error', async () => {
      redis.get.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.get('erp:cache:x:1')).resolves.toBeUndefined();
    });
  });

  describe('set', () => {
    it('serializes the value and always sets an expiry', async () => {
      redis.set.mockResolvedValue('OK');

      await service.set('erp:cache:x:1', { a: 1 }, 60);

      expect(redis.set).toHaveBeenCalledWith(
        'erp:cache:x:1',
        JSON.stringify({ a: 1 }),
        'EX',
        60,
      );
    });

    it('swallows a Redis error without throwing', async () => {
      redis.set.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        service.set('erp:cache:x:1', { a: 1 }, 60),
      ).resolves.toBeUndefined();
    });
  });

  describe('delete', () => {
    it('deletes the key', async () => {
      redis.del.mockResolvedValue(1);

      await service.delete('erp:cache:x:1');

      expect(redis.del).toHaveBeenCalledWith('erp:cache:x:1');
    });

    it('swallows a Redis error without throwing', async () => {
      redis.del.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.delete('erp:cache:x:1')).resolves.toBeUndefined();
    });
  });

  describe('exists', () => {
    it('returns true when the key exists', async () => {
      redis.exists.mockResolvedValue(1);

      await expect(service.exists('erp:cache:x:1')).resolves.toBe(true);
    });

    it('returns false when the key does not exist', async () => {
      redis.exists.mockResolvedValue(0);

      await expect(service.exists('erp:cache:x:1')).resolves.toBe(false);
    });

    it('returns false on a Redis error', async () => {
      redis.exists.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.exists('erp:cache:x:1')).resolves.toBe(false);
    });
  });

  describe('ttl', () => {
    it('returns the real TTL', async () => {
      redis.ttl.mockResolvedValue(42);

      await expect(service.ttl('erp:cache:x:1')).resolves.toBe(42);
    });

    it('returns -2 on a Redis error (treated as "not cached")', async () => {
      redis.ttl.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.ttl('erp:cache:x:1')).resolves.toBe(-2);
    });
  });

  describe('isConnected', () => {
    it('returns true when PING succeeds', async () => {
      redis.ping.mockResolvedValue('PONG');

      await expect(service.isConnected()).resolves.toBe(true);
    });

    it('returns false when PING throws (Redis unreachable)', async () => {
      redis.ping.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.isConnected()).resolves.toBe(false);
    });
  });

  describe('increment', () => {
    it('increments a counter and applies TTL on first use', async () => {
      redis.incr.mockResolvedValue(1);
      redis.expire.mockResolvedValue(1);

      await expect(
        service.increment('erp:security:rl:login', 60),
      ).resolves.toBe(1);
      expect(redis.expire).toHaveBeenCalledWith('erp:security:rl:login', 60);
    });

    it('does not reapply TTL when the counter already exists', async () => {
      redis.incr.mockResolvedValue(2);

      await expect(
        service.increment('erp:security:rl:login', 60),
      ).resolves.toBe(2);
      expect(redis.expire).not.toHaveBeenCalled();
    });

    it('fails open when Redis increment throws', async () => {
      redis.incr.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        service.increment('erp:security:rl:login', 60),
      ).resolves.toBeUndefined();
    });
  });
});
