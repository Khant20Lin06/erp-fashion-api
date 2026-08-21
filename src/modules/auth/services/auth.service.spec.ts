import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { User } from '../../users/entities/user.entity';
import { UserStatus } from '../../users/entities/user-status.enum';
import { PasswordResetToken } from '../../users/entities/password-reset-token.entity';
import { RefreshSession } from '../entities/refresh-session.entity';
import { AppException } from '../../../core/errors/app.exception';
import { AuthConfig } from '../../../config/auth.config';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: jest.Mocked<Pick<Repository<User>, 'findOne' | 'save'>>;
  let resetTokenRepository: jest.Mocked<
    Pick<Repository<PasswordResetToken>, 'findOne' | 'save' | 'create'>
  >;
  let refreshSessionRepository: jest.Mocked<
    Pick<Repository<RefreshSession>, 'findOne' | 'save' | 'create' | 'update'>
  >;
  let passwordService: jest.Mocked<
    Pick<PasswordService, 'verify' | 'hash' | 'validatePolicy'>
  >;
  let tokenService: jest.Mocked<
    Pick<
      TokenService,
      'signAccessToken' | 'generateRefreshToken' | 'hashRefreshToken'
    >
  >;
  let transactionService: TransactionService;

  const authConfig: AuthConfig = {
    jwtSecret: 'a'.repeat(32),
    jwtAccessTokenExpiresIn: '15m',
    jwtIssuer: 'fashion-erp-backend',
    jwtAudience: 'fashion-erp-frontend',
    cookieName: 'fashion_erp_access_token',
    cookieSecure: true,
    cookieSameSite: 'lax',
    cookieDomain: undefined,
    cookiePath: '/',
    passwordResetTokenExpiresInMinutes: 30,
    authRateLimitMaxAttempts: 10,
    authRateLimitWindowSeconds: 60,
    refreshCookieName: 'fashion_erp_refresh_token',
    refreshCookiePath: '/',
    refreshTokenExpiresInDays: 30,
  };

  const configService = {
    get: jest.fn().mockReturnValue(authConfig),
  } as unknown as ConfigService;

  const buildUser = (overrides: Partial<User> = {}): User => ({
    id: 'user-123',
    email: 'user@example.com',
    passwordHash: 'stored-hash',
    firstName: 'Ada',
    lastName: 'Lovelace',
    displayName: 'Ada Lovelace',
    status: UserStatus.Active,
    isEmailVerified: false,
    lastLoginAt: null,
    passwordChangedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  });

  beforeEach(() => {
    userRepository = { findOne: jest.fn(), save: jest.fn() };
    resetTokenRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest
        .fn()
        .mockImplementation(
          (value: Partial<PasswordResetToken>) => value as PasswordResetToken,
        ),
    };
    refreshSessionRepository = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((v) => Promise.resolve(v)),
      create: jest
        .fn()
        .mockImplementation(
          (value: Partial<RefreshSession>) => value as RefreshSession,
        ),
      update: jest.fn(),
    };
    passwordService = {
      verify: jest.fn(),
      hash: jest.fn(),
      validatePolicy: jest.fn(),
    };
    tokenService = {
      signAccessToken: jest.fn().mockReturnValue('signed-jwt'),
      generateRefreshToken: jest.fn().mockReturnValue('raw-refresh-token'),
      hashRefreshToken: jest.fn().mockReturnValue('hashed-refresh-token'),
    };
    transactionService = new TransactionService(
      undefined as unknown as import('typeorm').DataSource,
    );

    service = new AuthService(
      userRepository as unknown as Repository<User>,
      resetTokenRepository as unknown as Repository<PasswordResetToken>,
      refreshSessionRepository as unknown as Repository<RefreshSession>,
      passwordService,
      tokenService as unknown as TokenService,
      transactionService,
      configService,
    );
  });

  describe('login', () => {
    it('returns a safe user and access token for valid credentials', async () => {
      const user = buildUser();
      userRepository.findOne.mockResolvedValue(user);
      passwordService.verify.mockResolvedValue(true);
      userRepository.save.mockResolvedValue(user);

      const result = await service.login(
        'user@example.com',
        'correct-password',
      );

      expect(result.accessToken).toBe('signed-jwt');
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user.email).toBe('user@example.com');
    });

    it('normalizes email case before lookup', async () => {
      userRepository.findOne.mockResolvedValue(null);
      passwordService.verify.mockResolvedValue(false);

      await expect(
        service.login('User@Example.com', 'whatever'),
      ).rejects.toThrow(AppException);

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'user@example.com' },
      });
    });

    it('throws generic Unauthorized for an unknown email', async () => {
      userRepository.findOne.mockResolvedValue(null);
      passwordService.verify.mockResolvedValue(false);

      await expect(
        service.login('unknown@example.com', 'anything'),
      ).rejects.toMatchObject({ message: 'Invalid email or password' });
    });

    it('throws the same generic message for a wrong password', async () => {
      userRepository.findOne.mockResolvedValue(buildUser());
      passwordService.verify.mockResolvedValue(false);

      await expect(
        service.login('user@example.com', 'wrong-password'),
      ).rejects.toMatchObject({ message: 'Invalid email or password' });
    });

    it('rejects login for an inactive user', async () => {
      userRepository.findOne.mockResolvedValue(
        buildUser({ status: UserStatus.Inactive }),
      );
      passwordService.verify.mockResolvedValue(true);

      await expect(
        service.login('user@example.com', 'correct-password'),
      ).rejects.toMatchObject({ message: 'Invalid email or password' });
    });

    it('rejects login for a suspended user', async () => {
      userRepository.findOne.mockResolvedValue(
        buildUser({ status: UserStatus.Suspended }),
      );
      passwordService.verify.mockResolvedValue(true);

      await expect(
        service.login('user@example.com', 'correct-password'),
      ).rejects.toMatchObject({ message: 'Invalid email or password' });
    });

    it('never includes passwordHash in the returned user', async () => {
      userRepository.findOne.mockResolvedValue(buildUser());
      passwordService.verify.mockResolvedValue(true);
      userRepository.save.mockImplementation((u) => Promise.resolve(u as User));

      const result = await service.login(
        'user@example.com',
        'correct-password',
      );

      expect(JSON.stringify(result.user)).not.toContain('passwordHash');
      expect(JSON.stringify(result.user)).not.toContain('stored-hash');
    });
  });

  describe('changePassword', () => {
    it('rejects an incorrect current password', async () => {
      userRepository.findOne.mockResolvedValue(buildUser());
      passwordService.verify.mockResolvedValue(false);

      await expect(
        service.changePassword('user-123', 'wrong-current', 'newpassword123'),
      ).rejects.toThrow(AppException);
    });

    it('rejects a weak new password', async () => {
      userRepository.findOne.mockResolvedValue(buildUser());
      passwordService.verify.mockResolvedValue(true);
      passwordService.validatePolicy.mockReturnValue(false);

      await expect(
        service.changePassword('user-123', 'correct-current', 'weak'),
      ).rejects.toThrow(AppException);
    });

    it('updates the password hash on success', async () => {
      const user = buildUser();
      userRepository.findOne.mockResolvedValue(user);
      passwordService.verify.mockResolvedValue(true);
      passwordService.validatePolicy.mockReturnValue(true);
      passwordService.hash.mockResolvedValue('new-hash');
      userRepository.save.mockResolvedValue(user);

      await service.changePassword(
        'user-123',
        'correct-current',
        'newpassword123',
      );

      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ passwordHash: 'new-hash' }),
      );
    });
  });

  describe('forgotPassword', () => {
    it('does nothing observable for an unknown email (no enumeration)', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.forgotPassword('unknown@example.com'),
      ).resolves.toBeUndefined();
      expect(resetTokenRepository.save).not.toHaveBeenCalled();
    });

    it('creates a reset token for a known active user', async () => {
      userRepository.findOne.mockResolvedValue(buildUser());
      resetTokenRepository.save.mockResolvedValue({} as PasswordResetToken);

      await service.forgotPassword('user@example.com');

      expect(resetTokenRepository.save).toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    const buildSession = (
      overrides: Partial<RefreshSession> = {},
    ): RefreshSession =>
      ({
        id: 'session-1',
        userId: 'user-123',
        tokenHash: 'hashed-refresh-token',
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        replacedById: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        ...overrides,
      }) as RefreshSession;

    /** Stubs transactionService.run to hand the test a fake EntityManager backed by the mocked repository. */
    function stubTransaction(manager: {
      findOne: jest.Mock;
      save: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
    }) {
      jest
        .spyOn(transactionService, 'run')
        .mockImplementation(async (work) => work(manager as never));
    }

    it('rejects a refresh token that does not exist', async () => {
      refreshSessionRepository.findOne.mockResolvedValue(null);

      await expect(service.refresh('unknown-token')).rejects.toMatchObject({
        message: 'Invalid or expired session',
      });
    });

    it('rejects an expired refresh token', async () => {
      refreshSessionRepository.findOne.mockResolvedValue(
        buildSession({ expiresAt: new Date(Date.now() - 1000) }),
      );
      const manager = {
        findOne: jest
          .fn()
          .mockResolvedValue(
            buildSession({ expiresAt: new Date(Date.now() - 1000) }),
          ),
        save: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      };
      stubTransaction(manager);

      await expect(service.refresh('expired-token')).rejects.toMatchObject({
        message: 'Invalid or expired session',
      });
    });

    it('rejects an already-revoked refresh token without minting a new access token', async () => {
      refreshSessionRepository.findOne.mockResolvedValue(
        buildSession({ revokedAt: new Date() }),
      );

      await expect(service.refresh('revoked-token')).rejects.toMatchObject({
        message: 'Invalid or expired session',
      });
      expect(tokenService.signAccessToken).not.toHaveBeenCalled();
    });

    it('revokes the rotated-into session when a rotated-out token is reused, even though the refresh itself fails', async () => {
      refreshSessionRepository.findOne.mockResolvedValue(
        buildSession({ revokedAt: new Date(), replacedById: 'session-2' }),
      );

      await expect(service.refresh('reused-token')).rejects.toThrow(
        AppException,
      );
      // Must be revoked via the plain repository, NOT inside transactionService.run —
      // a rollback from the throw below would otherwise silently undo it.
      expect(refreshSessionRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'session-2' }),
        expect.objectContaining({ revokedAt: expect.any(Date) as Date }),
      );
    });

    it('issues a new access token and rotates the refresh token on success', async () => {
      const session = buildSession();
      refreshSessionRepository.findOne.mockResolvedValue(session);
      const manager = {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(session) // RefreshSession lookup
          .mockResolvedValueOnce(buildUser()), // User lookup
        save: jest.fn().mockImplementation((v) => Promise.resolve(v)),
        update: jest.fn(),
        create: jest
          .fn()
          .mockImplementation((_entity, value: Partial<RefreshSession>) => ({
            id: 'session-2',
            ...value,
          })),
      };
      stubTransaction(manager);

      const result = await service.refresh('valid-raw-token');

      expect(result.accessToken).toBe('signed-jwt');
      expect(result.refreshToken).toBe('raw-refresh-token');
      expect(session.revokedAt).not.toBeNull();
      expect(session.replacedById).toBe('session-2');
    });

    it('rejects refresh for a user who is no longer active', async () => {
      const session = buildSession();
      refreshSessionRepository.findOne.mockResolvedValue(session);
      const manager = {
        findOne: jest
          .fn()
          .mockResolvedValueOnce(session)
          .mockResolvedValueOnce(buildUser({ status: UserStatus.Suspended })),
        save: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      };
      stubTransaction(manager);

      await expect(service.refresh('valid-raw-token')).rejects.toMatchObject({
        message: 'Invalid or expired session',
      });
    });
  });

  describe('revokeRefreshSession', () => {
    it('revokes only the matching, not-already-revoked session', async () => {
      await service.revokeRefreshSession('raw-token');

      expect(refreshSessionRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ tokenHash: 'hashed-refresh-token' }),
        expect.objectContaining({ revokedAt: expect.any(Date) as Date }),
      );
    });
  });

  describe('getCurrentUser', () => {
    it('returns a safe user for an active user id', async () => {
      userRepository.findOne.mockResolvedValue(buildUser());

      const result = await service.getCurrentUser('user-123');

      expect(result.id).toBe('user-123');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('throws Unauthorized when the user no longer exists', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.getCurrentUser('missing-user')).rejects.toThrow(
        AppException,
      );
    });
  });
});
