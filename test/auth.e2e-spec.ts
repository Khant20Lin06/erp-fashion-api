import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter';
import { User } from '../src/modules/users/entities/user.entity';
import { UserStatus } from '../src/modules/users/entities/user-status.enum';
import { PasswordResetToken } from '../src/modules/users/entities/password-reset-token.entity';
import { PasswordService } from '../src/modules/auth/services/password.service';
import { hashResetToken } from '../src/modules/auth/services/reset-token.util';
import { SafeUserDto } from '../src/modules/auth/dto/safe-user.dto';
import { CacheService } from '../src/modules/redis/cache.service';

interface ErrorResponseBody {
  message: string;
}

interface LoginResponseBody {
  user: SafeUserDto;
}

const dbEnvAvailable =
  !!process.env.DB_USERNAME &&
  !!process.env.DB_PASSWORD &&
  !!process.env.DB_DATABASE;

const describeIfDb = dbEnvAvailable ? describe : describe.skip;

describeIfDb('Authentication (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let passwordService: PasswordService;
  let cacheService: CacheService;
  let activeUser: User;
  const activeUserPassword = 'correct-horse-battery-staple';
  let currentActiveUserPassword = activeUserPassword;

  const extractAccessToken = (response: request.Response): string => {
    const setCookie = response.headers['set-cookie'] as
      string[] | string | undefined;
    const cookieValue = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    const match = String(cookieValue).match(/fashion_erp_access_token=([^;]+)/);
    return match?.[1] ?? '';
  };

  const extractCookieValue = (
    response: request.Response,
    cookieName: string,
  ): string => {
    const setCookie = response.headers['set-cookie'] as
      string[] | string | undefined;
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? ''];
    const match = cookies
      .map((c) => String(c).match(new RegExp(`${cookieName}=([^;]+)`)))
      .find((m) => m);
    return match?.[1] ?? '';
  };

  const extractCookieAttributes = (
    response: request.Response,
    cookieName: string,
  ): string => {
    const setCookie = response.headers['set-cookie'] as
      string[] | string | undefined;
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? ''];
    return cookies.find((c) => c.startsWith(`${cookieName}=`)) ?? '';
  };

  const clearLoginRateLimit = async (email: string): Promise<void> => {
    const candidates = ['127.0.0.1', '::1', '::ffff:127.0.0.1', 'unknown'];

    await Promise.all(
      candidates.map((ip) =>
        cacheService.delete(
          `erp:security:auth-rate-limit:login:${ip}:${email.trim().toLowerCase()}`,
        ),
      ),
    );
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.use(cookieParser());

    await app.init();

    dataSource = moduleFixture.get(DataSource);
    passwordService = moduleFixture.get(PasswordService);
    cacheService = moduleFixture.get(CacheService);

    await dataSource.query(
      "DELETE FROM refresh_sessions WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email IN ('active-user@example.com', 'suspended-user@example.com')) t)",
    );
    await dataSource.query(
      "DELETE FROM password_reset_tokens WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email IN ('active-user@example.com', 'suspended-user@example.com')) t)",
    );
    await dataSource.query(
      "DELETE FROM users WHERE email IN ('active-user@example.com', 'suspended-user@example.com')",
    );

    const userRepository = dataSource.getRepository(User);
    activeUser = await userRepository.save(
      userRepository.create({
        email: 'active-user@example.com',
        passwordHash: await passwordService.hash(activeUserPassword),
        firstName: 'Ada',
        lastName: 'Lovelace',
        displayName: 'Ada Lovelace',
        status: UserStatus.Active,
        isEmailVerified: true,
        lastLoginAt: null,
        passwordChangedAt: null,
      }),
    );

    await userRepository.save(
      userRepository.create({
        email: 'suspended-user@example.com',
        passwordHash: await passwordService.hash('irrelevant-password'),
        firstName: 'Suspended',
        lastName: 'User',
        displayName: 'Suspended User',
        status: UserStatus.Suspended,
        isEmailVerified: true,
        lastLoginAt: null,
        passwordChangedAt: null,
      }),
    );
  });

  beforeEach(async () => {
    await Promise.all([
      clearLoginRateLimit(activeUser.email),
      clearLoginRateLimit('rate-limit-target@example.com'),
      clearLoginRateLimit('suspended-user@example.com'),
      clearLoginRateLimit('nobody@example.com'),
    ]);
  });

  afterAll(async () => {
    await dataSource.query(
      "DELETE FROM refresh_sessions WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email IN ('active-user@example.com', 'suspended-user@example.com')) t)",
    );
    await dataSource.query(
      "DELETE FROM password_reset_tokens WHERE user_id IN (SELECT id FROM (SELECT id FROM users WHERE email IN ('active-user@example.com', 'suspended-user@example.com')) t)",
    );
    await dataSource.query(
      "DELETE FROM users WHERE email IN ('active-user@example.com', 'suspended-user@example.com')",
    );
    await app.close();
  });

  describe('POST /api/v1/auth/login', () => {
    it('rejects an unknown email with a generic message', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password: 'whatever123' });

      expect(response.status).toBe(401);
      expect((response.body as ErrorResponseBody).message).toBe(
        'Invalid email or password',
      );
    });

    it('rejects the correct email with the wrong password using the same message', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: activeUser.email, password: 'totally-wrong' });

      expect(response.status).toBe(401);
      expect((response.body as ErrorResponseBody).message).toBe(
        'Invalid email or password',
      );
    });

    it('rejects a suspended user even with the correct password', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'suspended-user@example.com',
          password: 'irrelevant-password',
        });

      expect(response.status).toBe(401);
    });

    it('rejects malformed input', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email' });

      expect(response.status).toBe(400);
    });

    it('logs in successfully and sets an httpOnly cookie', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: activeUser.email, password: currentActiveUserPassword });

      expect(response.status).toBe(200);
      const body = response.body as LoginResponseBody;
      expect(body.user.email).toBe(activeUser.email);
      expect(body.user).not.toHaveProperty('passwordHash');

      const setCookieHeader = response.headers['set-cookie'];
      expect(setCookieHeader).toBeDefined();
      const cookieString = Array.isArray(setCookieHeader)
        ? setCookieHeader.join(';')
        : String(setCookieHeader);
      expect(cookieString).toContain('fashion_erp_access_token=');
      expect(cookieString.toLowerCase()).toContain('httponly');
    });

    it('logs in with a different-cased email (case-insensitive)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: activeUser.email.toUpperCase(),
          password: currentActiveUserPassword,
        });

      expect(response.status).toBe(200);
    });

    it('supports reusing the same JWT through the Authorization bearer header', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: activeUser.email, password: currentActiveUserPassword });
      const token = extractAccessToken(loginResponse);

      const meResponse = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(meResponse.status).toBe(200);
      expect((meResponse.body as SafeUserDto).email).toBe(activeUser.email);
    });

    it('rejects a malformed Authorization header', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Token not-a-bearer-token');

      expect(response.status).toBe(401);
    });

    it('rate-limits repeated invalid login attempts for the same source+email', async () => {
      let lastResponse: request.Response | undefined;

      for (let attempt = 0; attempt < 11; attempt += 1) {
        lastResponse = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            email: 'rate-limit-target@example.com',
            password: 'definitely-wrong-password',
          });
      }

      expect(lastResponse?.status).toBe(429);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns 401 without a session cookie', async () => {
      const response = await request(app.getHttpServer()).get(
        '/api/v1/auth/me',
      );

      expect(response.status).toBe(401);
    });

    it('returns 401 with a garbage cookie value', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Cookie', ['fashion_erp_access_token=garbage-not-a-jwt']);

      expect(response.status).toBe(401);
    });

    it('returns the authenticated user profile with a valid session', async () => {
      const agent = request.agent(app.getHttpServer());
      await agent
        .post('/api/v1/auth/login')
        .send({ email: activeUser.email, password: currentActiveUserPassword });

      const response = await agent.get('/api/v1/auth/me');

      expect(response.status).toBe(200);
      const body = response.body as SafeUserDto;
      expect(body.email).toBe(activeUser.email);
      expect(body).not.toHaveProperty('passwordHash');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('clears the session cookie and invalidates further /me calls', async () => {
      const agent = request.agent(app.getHttpServer());
      await agent
        .post('/api/v1/auth/login')
        .send({ email: activeUser.email, password: currentActiveUserPassword });

      const logoutResponse = await agent.post('/api/v1/auth/logout');
      expect(logoutResponse.status).toBe(200);

      const meResponse = await agent.get('/api/v1/auth/me');
      expect(meResponse.status).toBe(401);
    });

    it('requires authentication to call logout', async () => {
      const response = await request(app.getHttpServer()).post(
        '/api/v1/auth/logout',
      );

      expect(response.status).toBe(401);
    });

    it('revokes the refresh session so a later refresh attempt is rejected', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: activeUser.email, password: currentActiveUserPassword });
      const refreshToken = extractCookieValue(
        loginResponse,
        'fashion_erp_refresh_token',
      );
      const accessToken = extractAccessToken(loginResponse);

      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Cookie', [
          `fashion_erp_access_token=${accessToken}`,
          `fashion_erp_refresh_token=${refreshToken}`,
        ]);

      const refreshAfterLogout = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`fashion_erp_refresh_token=${refreshToken}`]);

      expect(refreshAfterLogout.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('creates a refresh session on login with an httpOnly cookie', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: activeUser.email, password: currentActiveUserPassword });

      const refreshCookieAttrs = extractCookieAttributes(
        response,
        'fashion_erp_refresh_token',
      );
      expect(refreshCookieAttrs).toBeTruthy();
      expect(refreshCookieAttrs.toLowerCase()).toContain('httponly');
      // Path is `/` (matching the access-token cookie), not scoped to
      // /auth — a same-origin frontend proxying through routes that don't
      // mirror the backend's own /auth/* paths still needs this cookie
      // delivered, so it can't be narrowly path-scoped. See auth.config.ts.
      expect(refreshCookieAttrs).toContain('Path=/');
    });

    it('rejects a request with no refresh cookie at all', async () => {
      const response = await request(app.getHttpServer()).post(
        '/api/v1/auth/refresh',
      );

      expect(response.status).toBe(401);
    });

    it('rejects a garbage/unknown refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', ['fashion_erp_refresh_token=not-a-real-token']);

      expect(response.status).toBe(401);
    });

    it('issues a new access token and a rotated refresh cookie on success', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: activeUser.email, password: currentActiveUserPassword });
      const originalRefreshToken = extractCookieValue(
        loginResponse,
        'fashion_erp_refresh_token',
      );
      const originalAccessToken = extractAccessToken(loginResponse);

      const refreshResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`fashion_erp_refresh_token=${originalRefreshToken}`]);

      expect(refreshResponse.status).toBe(200);
      const newAccessToken = extractAccessToken(refreshResponse);
      const newRefreshToken = extractCookieValue(
        refreshResponse,
        'fashion_erp_refresh_token',
      );
      expect(newAccessToken).toBeTruthy();
      expect(newAccessToken).not.toBe(originalAccessToken);
      expect(newRefreshToken).toBeTruthy();
      expect(newRefreshToken).not.toBe(originalRefreshToken);

      // the new access token actually authenticates
      const meResponse = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${newAccessToken}`);
      expect(meResponse.status).toBe(200);
    });

    it('rejects reuse of an already-rotated (old) refresh token', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: activeUser.email, password: currentActiveUserPassword });
      const originalRefreshToken = extractCookieValue(
        loginResponse,
        'fashion_erp_refresh_token',
      );

      // first refresh rotates the token — this should succeed
      const firstRefresh = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`fashion_erp_refresh_token=${originalRefreshToken}`]);
      expect(firstRefresh.status).toBe(200);

      // reusing the now-rotated-out original token must be rejected
      const reuseAttempt = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`fashion_erp_refresh_token=${originalRefreshToken}`]);
      expect(reuseAttempt.status).toBe(401);
    });

    it('breaks the whole rotation chain when a rotated-out token is reused', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: activeUser.email, password: currentActiveUserPassword });
      const originalRefreshToken = extractCookieValue(
        loginResponse,
        'fashion_erp_refresh_token',
      );

      const firstRefresh = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`fashion_erp_refresh_token=${originalRefreshToken}`]);
      const rotatedToken = extractCookieValue(
        firstRefresh,
        'fashion_erp_refresh_token',
      );

      // replay the original (already-rotated) token — this should revoke the chain
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`fashion_erp_refresh_token=${originalRefreshToken}`]);

      // the token that the first refresh rotated into must now also be dead
      const secondRefreshAttempt = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`fashion_erp_refresh_token=${rotatedToken}`]);
      expect(secondRefreshAttempt.status).toBe(401);
    });

    it('never returns the refresh token in the JSON body', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: activeUser.email, password: currentActiveUserPassword });
      const refreshToken = extractCookieValue(
        loginResponse,
        'fashion_erp_refresh_token',
      );

      const refreshResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`fashion_erp_refresh_token=${refreshToken}`]);

      expect(JSON.stringify(refreshResponse.body)).not.toContain(refreshToken);
      const setCookie = refreshResponse.headers['set-cookie'];
      const newRefreshToken = extractCookieValue(
        refreshResponse,
        'fashion_erp_refresh_token',
      );
      expect(JSON.stringify(refreshResponse.body)).not.toContain(
        newRefreshToken,
      );
      expect(setCookie).toBeDefined();
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
    it('rejects an incorrect current password', async () => {
      const agent = request.agent(app.getHttpServer());
      await agent
        .post('/api/v1/auth/login')
        .send({ email: activeUser.email, password: activeUserPassword });

      const response = await agent.post('/api/v1/auth/change-password').send({
        currentPassword: 'wrong-current-password',
        newPassword: 'brand-new-password-123',
      });

      expect(response.status).toBe(401);
    });

    it('rejects a weak new password', async () => {
      const agent = request.agent(app.getHttpServer());
      await agent
        .post('/api/v1/auth/login')
        .send({ email: activeUser.email, password: activeUserPassword });

      const response = await agent.post('/api/v1/auth/change-password').send({
        currentPassword: activeUserPassword,
        newPassword: 'short',
      });

      expect(response.status).toBe(400);
    });

    it('changes the password and allows login with the new password', async () => {
      const agent = request.agent(app.getHttpServer());
      const loginResponse = await agent
        .post('/api/v1/auth/login')
        .send({ email: activeUser.email, password: currentActiveUserPassword });

      const changeResponse = await agent
        .post('/api/v1/auth/change-password')
        .send({
          currentPassword: currentActiveUserPassword,
          newPassword: 'a-brand-new-password-456',
        });
      expect(changeResponse.status).toBe(200);
      const staleToken = extractAccessToken(loginResponse);
      currentActiveUserPassword = 'a-brand-new-password-456';

      const loginWithNewPassword = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: activeUser.email,
          password: 'a-brand-new-password-456',
        });
      expect(loginWithNewPassword.status).toBe(200);

      const loginWithOldPassword = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: activeUser.email, password: activeUserPassword });
      expect(loginWithOldPassword.status).toBe(401);

      const staleTokenResponse = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${staleToken}`);
      expect(staleTokenResponse.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/forgot-password + reset-password', () => {
    it('returns the same generic response for known and unknown emails', async () => {
      const known = await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: activeUser.email });
      const unknown = await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'never-registered@example.com' });

      expect(known.status).toBe(200);
      expect(unknown.status).toBe(200);
      expect(known.body).toEqual(unknown.body);
    });

    it('rejects an invalid reset token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({ token: 'not-a-real-token', newPassword: 'newpassword789' });

      expect(response.status).toBe(400);
    });

    it('rejects an expired reset token', async () => {
      const resetTokenRepository = dataSource.getRepository(PasswordResetToken);
      const rawToken = 'expired-raw-token-value';
      await resetTokenRepository.save(
        resetTokenRepository.create({
          userId: activeUser.id,
          tokenHash: hashResetToken(rawToken),
          expiresAt: new Date(Date.now() - 60_000),
          usedAt: null,
        }),
      );

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({ token: rawToken, newPassword: 'newpassword789' });

      expect(response.status).toBe(400);
    });

    it('resets the password with a valid token and the token cannot be reused', async () => {
      const resetTokenRepository = dataSource.getRepository(PasswordResetToken);
      const rawToken = 'valid-raw-token-value';
      await resetTokenRepository.save(
        resetTokenRepository.create({
          userId: activeUser.id,
          tokenHash: hashResetToken(rawToken),
          expiresAt: new Date(Date.now() + 60_000),
          usedAt: null,
        }),
      );

      const firstAttempt = await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({ token: rawToken, newPassword: 'reset-password-999' });
      expect(firstAttempt.status).toBe(200);
      currentActiveUserPassword = 'reset-password-999';

      const loginWithResetPassword = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: activeUser.email, password: 'reset-password-999' });
      expect(loginWithResetPassword.status).toBe(200);

      const secondAttempt = await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({ token: rawToken, newPassword: 'another-password-000' });
      expect(secondAttempt.status).toBe(400);
    });
  });

  describe('response security', () => {
    it('never returns passwordHash from any auth endpoint', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: activeUser.email, password: currentActiveUserPassword });

      expect(JSON.stringify(loginResponse.body)).not.toMatch(/passwordHash/i);
      expect(JSON.stringify(loginResponse.body)).not.toContain('$argon2');
    });

    it('rejects an existing token after the account is deactivated', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: activeUser.email, password: currentActiveUserPassword });
      const token = extractAccessToken(loginResponse);

      await dataSource
        .getRepository(User)
        .update({ id: activeUser.id }, { status: UserStatus.Inactive });

      const meResponse = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(meResponse.status).toBe(401);

      await dataSource
        .getRepository(User)
        .update({ id: activeUser.id }, { status: UserStatus.Active });
    });
  });
});
