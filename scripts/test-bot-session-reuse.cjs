/* Run: node -r ts-node/register/transpile-only scripts/test-bot-session-reuse.cjs
 * Real MySQL row locks, independent connection pools, Redis, Argon2 and JWTs.
 * Only the fixed disposable database below is writable. No messages/orders.
 */
require('dotenv/config');
require('reflect-metadata');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { DataSource } = require('typeorm');
const { JwtService } = require('@nestjs/jwt');
const Redis = require('ioredis');
const { User } = require('../src/modules/users/entities/user.entity');
const { RefreshSession } = require('../src/modules/auth/entities/refresh-session.entity');
const { BotSessionService } = require('../src/modules/auth/services/bot-session.service');
const { PasswordService } = require('../src/modules/auth/services/password.service');
const { TokenService } = require('../src/modules/auth/services/token.service');
const { JwtAuthGuard } = require('../src/modules/auth/guards/jwt-auth.guard');
const { TransactionService } = require('../src/core/transaction/transaction.service');
const { CacheService } = require('../src/modules/redis/cache.service');
const redisConfig = require('../src/config/redis.config').default;

const TEST_DATABASE = 'fashion_shopping_concurrency_test';
const options = {
  type: 'mysql', host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
  username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD,
  database: TEST_DATABASE, entities: [User, RefreshSession], synchronize: false,
  logging: false, extra: { connectionLimit: 12 },
};
const db = new DataSource(options);
const peerDb = new DataSource(options);
const userId = randomUUID();
const email = `bot-session-probe-${userId}@example.test`;
const password = randomBytes(32).toString('hex');
const ownedKeys = new Set();
let redis;
let createdUser = false;
let phase = 'initialize';
let timing;

(async () => {
  try {
    await db.initialize();
    assert.equal((await db.query('SELECT DATABASE() AS name'))[0].name, TEST_DATABASE);
    // Create only missing auth tables; never synchronize/drop the shared schema.
    const schema = await db.driver.createSchemaBuilder().log();
    for (const table of ['users', 'refresh_sessions']) {
      const create = schema.upQueries.find(q => q.query.startsWith(`CREATE TABLE \`${table}\``));
      if (create) await db.query(create.query);
    }
    await peerDb.initialize();
    assert.equal((await peerDb.query('SELECT DATABASE() AS name'))[0].name, TEST_DATABASE);
    const rc = redisConfig();
    redis = new Redis({ host: rc.host, port: rc.port, password: rc.password, db: rc.db,
      lazyConnect: true, connectTimeout: 5000, maxRetriesPerRequest: 1, retryStrategy: () => null });
    redis.on('error', () => {}); // Safe generic failure is reported below, never connection credentials.
    await redis.connect();
    await redis.ping();
    const cache = new CacheService(redis);
    for (const operation of ['get', 'set', 'increment']) {
      const original = cache[operation].bind(cache);
      cache[operation] = (key, ...args) => { ownedKeys.add(key); return original(key, ...args); };
    }
    const passwords = new PasswordService();
    await db.getRepository(User).insert({ id: userId, email, passwordHash: await passwords.hash(password),
      firstName: 'Disposable', lastName: 'Probe', displayName: 'Disposable bot probe', status: 'ACTIVE', isEmailVerified: false });
    createdUser = true;
    const auth = { jwtSecret: randomBytes(48).toString('hex'), jwtAccessTokenExpiresIn: '15m',
      jwtIssuer: 'bot-session-runtime-probe', jwtAudience: 'bot-session-runtime-probe',
      botSessionAllowedEmails: [email], cookieName: 'probe-access',
      authRateLimitMaxAttempts: 10, authRateLimitWindowSeconds: 60 };
    const config = { get: () => auth };
    const tokens = new TokenService(new JwtService(), config);
    const peerTokens = new TokenService(new JwtService(), config);
    let issued = 0;
    for (const tokenService of [tokens, peerTokens]) {
      const sign = tokenService.signAccessToken.bind(tokenService);
      tokenService.signAccessToken = id => { issued++; return sign(id); };
      tokenService.generateRefreshToken = () => { throw new Error('Unexpected refresh-token issuance'); };
    }
    const service = new BotSessionService(new TransactionService(db), cache, passwords, tokens, config);
    const peer = new BotSessionService(new TransactionService(peerDb), cache, passwords, peerTokens, config);
    phase = 'concurrent-issuance';
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) =>
      (i % 2 ? peer : service).getSession(email, password, 'bot-session-runtime-probe')));
    assert.equal(issued, 1, 'Concurrent requests must issue exactly once');
    assert.equal(new Set(results.map(r => r.accessToken)).size, 1);
    const accessToken = results[0].accessToken;
    const cacheKey = [...ownedKeys].find(key => key.startsWith('erp:cache:auth:bot-session:'));
    const persisted = await redis.get(cacheKey);
    assert.ok(persisted && !persisted.includes(accessToken) && !persisted.includes(password));
    const ttl = await redis.ttl(cacheKey);
    assert.ok(ttl > 0 && ttl <= 870);
    assert.equal(await redis.get(`erp:security:auth-rate-limit:login:bot-session-runtime-probe:${email}`), '1');
    console.log('PASS: 20 simultaneous requests across two independent MySQL pools issue one encrypted cached JWT');

    const users = { findActiveById: id => db.getRepository(User).findOne({ where: { id, status: 'ACTIVE' } }) };
    const guard = new JwtAuthGuard(tokens, config, { setUserId() {} }, users);
    const authenticate = token => guard.canActivate({ switchToHttp: () => ({ getRequest: () => ({
      method: 'GET', url: '/probe', headers: { authorization: `Bearer ${token}` },
    }) }) });
    phase = 'guessing-limit';
    await authenticate(accessToken);
    for (let n = 0; n < 9; n++) {
      await assert.rejects(service.getSession(email, 'wrong-test-password', 'bot-session-runtime-probe'), e => e.status === 401);
    }
    await assert.rejects(service.getSession(email, 'wrong-test-password', 'bot-session-runtime-probe'), e => e.status === 429);
    assert.equal((await service.getSession(email, password, 'bot-session-runtime-probe')).accessToken, accessToken);
    console.log('PASS: guessing is bounded at ten attempts; warm valid reuse does not consume the login quota');

    phase = 'disable-and-allowlist';
    await db.getRepository(User).update(userId, { status: 'INACTIVE' });
    await assert.rejects(service.getSession(email, password, 'status-probe'), e => e.status === 401);
    await assert.rejects(authenticate(accessToken), e => e.status === 401);
    await db.getRepository(User).update(userId, { status: 'ACTIVE' });
    auth.botSessionAllowedEmails = [];
    await assert.rejects(service.getSession(email, password, 'allowlist-probe'), e => e.status === 401);
    auth.botSessionAllowedEmails = [email];

    // Wait past the DB's second precision before changing the password revision.
    await new Promise(resolve => setTimeout(resolve, 1100));
    const nextPassword = randomBytes(32).toString('hex');
    phase = 'password-reset-revocation';
    const nextPasswordHash = await passwords.hash(nextPassword);
    // Exercise the upper half of a second, where TIMESTAMP(0) may round up.
    const upperHalfDelay = (750 - (Date.now() % 1000) + 1000) % 1000;
    await new Promise(resolve => setTimeout(resolve, upperHalfDelay));
    const changedAt = new Date();
    await db.getRepository(User).update(userId, { passwordHash: nextPasswordHash, passwordChangedAt: changedAt });
    const persistedRevision = await db.getRepository(User).findOneByOrFail({ id: userId });
    timing = { submittedRevisionMs: changedAt.getTime(), storedRevisionMs: persistedRevision.passwordChangedAt.getTime(), nowMs: Date.now() };
    await assert.rejects(service.getSession(email, password, 'reset-probe'), e => e.status === 401);
    await assert.rejects(authenticate(accessToken), e => e.status === 401);
    phase = 'password-reset-new-session';
    timing.nowMs = Date.now();
    const revisionWaitMs = persistedRevision.passwordChangedAt.getTime() - Date.now();
    assert.ok(revisionWaitMs < 1000, 'Unexpected password revision clock skew');
    if (revisionWaitMs > 0) {
      // The guard must reject a JWT issued before the authoritative revision.
      // Wait only for this precision boundary; never relax or backdate it.
      const boundaryToken = tokens.signAccessToken(userId);
      if (tokens.verifyAccessToken(boundaryToken).iatMs < persistedRevision.passwordChangedAt.getTime()) {
        await assert.rejects(authenticate(boundaryToken), error => error.status === 401);
      }
      console.log('PASS: MySQL second-precision revision is ahead of wall clock; waiting for authoritative revision');
      await new Promise(resolve => setTimeout(resolve, revisionWaitMs + 20));
    }
    const reset = await service.getSession(email, nextPassword, 'reset-probe');
    assert.notEqual(reset.accessToken, accessToken);
    phase = 'password-reset-new-token-guard';
    await authenticate(reset.accessToken);
    console.log('PASS: real database disable/password reset revoke cached reuse and existing JWT guard access; allowlist removal denies reuse');

    // Remove only this probe's encrypted entries to exercise actual short expiry.
    for (const key of ownedKeys) if (key.startsWith('erp:cache:auth:bot-session:')) await redis.del(key);
    phase = 'short-token-expiry';
    auth.jwtAccessTokenExpiresIn = '1s';
    const short = await service.getSession(email, nextPassword, 'expiry-probe');
    await new Promise(resolve => setTimeout(resolve, 1200));
    await assert.rejects(authenticate(short.accessToken), e => e.status === 401);
    const renewed = await service.getSession(email, nextPassword, 'expiry-probe');
    assert.notEqual(renewed.accessToken, short.accessToken);
    await authenticate(renewed.accessToken);
    const refreshCount = await db.getRepository(RefreshSession).count({ where: { userId } });
    assert.equal(refreshCount, 0, 'Bot sessions must never grow refresh_sessions');
    console.log('PASS: real JWT expiry requires reauthentication; refresh-session row count remains zero');
  } finally {
    if (redis?.status === 'ready') {
      for (const key of ownedKeys) await redis.del(key);
    }
    redis?.disconnect();
    if (createdUser && db.isInitialized) await db.getRepository(User).delete(userId);
    if (peerDb.isInitialized) await peerDb.destroy();
    if (db.isInitialized) await db.destroy();
  }
})().catch(error => {
  console.error('FAIL: bot-session runtime probe', { phase, name: error?.name, code: error?.code || 'PROBE_FAILED', timing });
  process.exitCode = 1;
});
