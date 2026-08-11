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
  let activeUser: User;
  const activeUserPassword = 'correct-horse-battery-staple';

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

  afterAll(async () => {
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
        .send({ email: activeUser.email, password: activeUserPassword });

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
          password: activeUserPassword,
        });

      expect(response.status).toBe(200);
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
        .send({ email: activeUser.email, password: activeUserPassword });

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
        .send({ email: activeUser.email, password: activeUserPassword });

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
      await agent
        .post('/api/v1/auth/login')
        .send({ email: activeUser.email, password: activeUserPassword });

      const changeResponse = await agent
        .post('/api/v1/auth/change-password')
        .send({
          currentPassword: activeUserPassword,
          newPassword: 'a-brand-new-password-456',
        });
      expect(changeResponse.status).toBe(200);

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
        .send({ email: activeUser.email, password: 'reset-password-999' });

      expect(JSON.stringify(loginResponse.body)).not.toMatch(/passwordHash/i);
      expect(JSON.stringify(loginResponse.body)).not.toContain('$argon2');
    });
  });
});
