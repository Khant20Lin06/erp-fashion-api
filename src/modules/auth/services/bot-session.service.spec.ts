import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EntityManager } from 'typeorm';
import { BotSessionService } from './bot-session.service';
import { TokenService } from './token.service';
import { PasswordService } from './password.service';
import { CacheService } from '../../redis/cache.service';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { User } from '../../users/entities/user.entity';
import { UserStatus } from '../../users/entities/user-status.enum';

describe('BotSessionService', () => {
  const password = 'test-only-bot-password-93';
  const email = 'bot@example.test';
  let service: BotSessionService;
  let peer: BotSessionService;
  let user: User | null;
  let allowed: string[];
  let cache: Map<string, { value: unknown; ttl: number }>;
  let attempts: Map<string, number>;
  let limiterAvailable: boolean;
  let maxAttempts: number;
  let windowSeconds: number;
  let attemptTtls: number[];
  let passwordService: PasswordService;
  let tokenService: TokenService;
  let hash: string;

  beforeAll(async () => {
    hash = await new PasswordService().hash(password);
  });
  beforeEach(() => {
    allowed = [email];
    cache = new Map();
    attempts = new Map();
    limiterAvailable = true;
    maxAttempts = 10;
    windowSeconds = 60;
    attemptTtls = [];
    user = Object.assign(new User(), {
      id: '11111111-1111-4111-8111-111111111111',
      email,
      passwordHash: hash,
      firstName: 'Bot',
      lastName: 'Test',
      displayName: 'Test bot',
      status: UserStatus.Active,
      passwordChangedAt: null,
      deletedAt: null,
    });
    const config = {
      get: () => ({
        jwtSecret: 'test-only-secret-long-enough-for-hmac-key',
        jwtIssuer: 'test',
        jwtAudience: 'test',
        jwtAccessTokenExpiresIn: '15m',
        botSessionAllowedEmails: allowed,
        authRateLimitMaxAttempts: maxAttempts,
        authRateLimitWindowSeconds: windowSeconds,
      }),
    } as unknown as ConfigService;
    passwordService = new PasswordService();
    tokenService = new TokenService(new JwtService(), config);
    const cacheService = {
      get: (key: string) => Promise.resolve(cache.get(key)?.value),
      set: (key: string, value: unknown, ttl: number) => {
        cache.set(key, { value, ttl });
        return Promise.resolve();
      },
      delete: (key: string) => {
        cache.delete(key);
        return Promise.resolve();
      },
      increment: (key: string, ttl: number) => {
        attemptTtls.push(ttl);
        if (!limiterAvailable) return Promise.resolve(undefined);
        const next = (attempts.get(key) ?? 0) + 1;
        attempts.set(key, next);
        return Promise.resolve(next);
      },
    } as unknown as CacheService;
    // A shared transaction boundary models the database row lock across service instances.
    // Cross-process SQL locking is verified separately against MySQL.
    let tail = Promise.resolve();
    const transactions = {
      run: async <T>(work: (manager: EntityManager) => Promise<T>) => {
        const preceding = tail;
        let release!: () => void;
        tail = new Promise<void>((resolve) => {
          release = resolve;
        });
        await preceding;
        try {
          return await work({
            getRepository: () => ({
              findOne: () => Promise.resolve(user),
              update: () => Promise.resolve({}),
            }),
          } as unknown as EntityManager);
        } finally {
          release();
        }
      },
    } as TransactionService;
    service = new BotSessionService(
      transactions,
      cacheService,
      passwordService,
      tokenService,
      config,
    );
    peer = new BotSessionService(
      transactions,
      cacheService,
      passwordService,
      tokenService,
      config,
    );
  });
  afterEach(() => jest.restoreAllMocks());

  it('uses the configured three-attempt, five-minute login limit', async () => {
    maxAttempts = 3;
    windowSeconds = 300;
    for (let attempt = 0; attempt < 3; attempt++) {
      await expect(
        service.getSession(email, 'wrong', 'configured-source'),
      ).rejects.toMatchObject({ status: 401 });
    }
    await expect(
      service.getSession(email, 'wrong', 'configured-source'),
    ).rejects.toMatchObject({ status: 429 });
    expect(attemptTtls).toEqual([300, 300, 300, 300]);
  });

  it('reuses an encrypted access JWT across concurrent service instances without refresh issuance', async () => {
    const refresh = jest.spyOn(tokenService, 'generateRefreshToken');
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        (index % 2 ? service : peer).getSession(email, password, '127.0.0.1'),
      ),
    );
    expect(new Set(results.map((result) => result.accessToken)).size).toBe(1);
    expect(results[0].user).toEqual({
      id: user!.id,
      email,
      firstName: 'Bot',
      lastName: 'Test',
      displayName: 'Test bot',
      status: 'ACTIVE',
    });
    expect(results[0]).not.toHaveProperty('refreshToken');
    expect(refresh).not.toHaveBeenCalled();
    expect([...attempts.values()]).toEqual([1]);
    const persisted = JSON.stringify([...cache]);
    expect(persisted).not.toContain(results[0].accessToken);
    expect(persisted).not.toContain(password);
    expect(persisted).not.toContain(hash);
    expect([...cache.values()][0].ttl).toBeGreaterThan(0);
    expect([...cache.values()][0].ttl).toBeLessThanOrEqual(870);
  });

  it('rejects wrong credentials against a warm cache and limits guessing to ten attempts', async () => {
    await service.getSession(email, password, 'source');
    for (let n = 0; n < 9; n++) {
      await expect(
        service.getSession(email, 'wrong', 'source'),
      ).rejects.toMatchObject({ status: 401 });
    }
    await expect(
      service.getSession(email, 'wrong', 'source'),
    ).rejects.toMatchObject({ status: 429 });
    await expect(
      service.getSession(email, password, 'source'),
    ).resolves.toHaveProperty('accessToken');
  });

  it('fails closed on limiter outage for new authentication but serves a valid hit', async () => {
    const first = await service.getSession(email, password, 'source');
    limiterAvailable = false;
    expect(
      (await service.getSession(email, password, 'source')).accessToken,
    ).toBe(first.accessToken);
    await expect(
      service.getSession(email, 'wrong', 'source'),
    ).rejects.toMatchObject({ status: 503 });
  });

  it('is disabled by default and rejects removed allowlist entries even with a warm cache', async () => {
    await service.getSession(email, password, 'source');
    allowed.length = 0;
    await expect(
      service.getSession(email, password, 'source'),
    ).rejects.toMatchObject({ status: 401 });
  });

  it.each(['inactive', 'missing', 'deleted'])(
    'rejects a %s user despite a warm cache',
    async (state) => {
      await service.getSession(email, password, 'source');
      if (state === 'missing') user = null;
      else if (state === 'deleted') user!.deletedAt = new Date();
      else user!.status = 'INACTIVE' as UserStatus;
      await expect(
        service.getSession(email, password, 'source'),
      ).rejects.toMatchObject({ status: 401 });
    },
  );

  it('invalidates reuse on password revision and requires the current password', async () => {
    const first = await service.getSession(email, password, 'source');
    user!.passwordHash = await passwordService.hash('new-test-only-password');
    user!.passwordChangedAt = new Date();
    await expect(
      service.getSession(email, password, 'source'),
    ).rejects.toMatchObject({ status: 401 });
    const next = await service.getSession(
      email,
      'new-test-only-password',
      'source',
    );
    expect(next.accessToken).not.toBe(first.accessToken);
  });

  it('reauthenticates when cached JWT reaches the expiry safety margin', async () => {
    const first = await service.getSession(email, password, 'source');
    const expiredAt =
      tokenService.verifyAccessToken(first.accessToken).exp * 1000;
    jest.spyOn(Date, 'now').mockReturnValue(expiredAt - 20000);
    expect(
      (await service.getSession(email, password, 'source')).accessToken,
    ).not.toBe(first.accessToken);
    expect([...attempts.values()]).toEqual([2]);
  });

  it('rejects newly issued JWTs before a rounded password revision and accepts after it', async () => {
    const revisionMs = Date.now() + 500;
    user!.passwordChangedAt = new Date(revisionMs);
    await expect(
      service.getSession(email, password, 'revision-source'),
    ).rejects.toMatchObject({ status: 401 });
    expect(cache.size).toBe(0);
    jest.spyOn(Date, 'now').mockReturnValue(revisionMs + 1);
    const result = await service.getSession(email, password, 'revision-source');
    expect(
      tokenService.verifyAccessToken(result.accessToken).iatMs,
    ).toBeGreaterThanOrEqual(revisionMs);
  });

  it('reauthenticates after authenticated cache ciphertext is tampered', async () => {
    const first = await service.getSession(email, password, 'source');
    for (const entry of cache.values()) entry.value = 'invalid-ciphertext';
    const next = await service.getSession(email, password, 'source');
    expect(next.accessToken).not.toBe(first.accessToken);
    expect([...attempts.values()]).toEqual([2]);
  });
});
