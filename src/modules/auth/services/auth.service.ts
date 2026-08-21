import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { UserStatus } from '../../users/entities/user-status.enum';
import { PasswordResetToken } from '../../users/entities/password-reset-token.entity';
import { RefreshSession } from '../entities/refresh-session.entity';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { generateResetToken, hashResetToken } from './reset-token.util';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { AuthConfig } from '../../../config/auth.config';
import { toSafeUserDto, SafeUserDto } from '../dto/safe-user.dto';

const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';
const INVALID_REFRESH_MESSAGE = 'Invalid or expired session';

export type RefreshSessionIssue = {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(PasswordResetToken)
    private readonly resetTokenRepository: Repository<PasswordResetToken>,
    @InjectRepository(RefreshSession)
    private readonly refreshSessionRepository: Repository<RefreshSession>,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly transactionService: TransactionService,
    private readonly configService: ConfigService,
  ) {}

  private refreshExpiryDate(): Date {
    const authConfig = this.configService.get<AuthConfig>('auth')!;
    return new Date(
      Date.now() + authConfig.refreshTokenExpiresInDays * 24 * 60 * 60_000,
    );
  }

  /** Issues a brand-new refresh session for a user (login only — rotation goes through `refresh()`). */
  private async issueRefreshSession(userId: string): Promise<{
    refreshToken: string;
    refreshExpiresAt: Date;
  }> {
    const refreshToken = this.tokenService.generateRefreshToken();
    const refreshExpiresAt = this.refreshExpiryDate();

    await this.refreshSessionRepository.save(
      this.refreshSessionRepository.create({
        userId,
        tokenHash: this.tokenService.hashRefreshToken(refreshToken),
        expiresAt: refreshExpiresAt,
        revokedAt: null,
        replacedById: null,
      }),
    );

    return { refreshToken, refreshExpiresAt };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async login(
    email: string,
    plainPassword: string,
  ): Promise<{ user: SafeUserDto } & RefreshSessionIssue> {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (!user) {
      // Run a hash verification against a dummy value so the response
      // timing does not reveal whether the email exists.
      await this.passwordService.verify(
        plainPassword,
        '$argon2id$v=19$m=19456,t=2,p=1$MDAwMDAwMDAwMDAwMDAwMA$MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA',
      );
      this.logger.warn(`Failed login attempt for ${normalizedEmail}`);
      throw new AppException(
        ErrorCode.Unauthorized,
        INVALID_CREDENTIALS_MESSAGE,
      );
    }

    const passwordValid = await this.passwordService.verify(
      plainPassword,
      user.passwordHash,
    );

    if (!passwordValid) {
      this.logger.warn(`Failed login attempt for ${normalizedEmail}`);
      throw new AppException(
        ErrorCode.Unauthorized,
        INVALID_CREDENTIALS_MESSAGE,
      );
    }

    if (user.status !== UserStatus.Active) {
      this.logger.warn(
        `Rejected login for ${normalizedEmail} because account is not ACTIVE`,
      );
      throw new AppException(
        ErrorCode.Unauthorized,
        INVALID_CREDENTIALS_MESSAGE,
      );
    }

    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    const accessToken = this.tokenService.signAccessToken(user.id);
    const { refreshToken, refreshExpiresAt } = await this.issueRefreshSession(
      user.id,
    );

    return {
      user: toSafeUserDto(user),
      accessToken,
      refreshToken,
      refreshExpiresAt,
    };
  }

  async getCurrentUser(userId: string): Promise<SafeUserDto> {
    const user = await this.findActiveUserOrThrow(userId);
    return toSafeUserDto(user);
  }

  /**
   * Validates a raw refresh token, rotates it (revoke old, issue new — both
   * atomically, so a crash mid-rotation can never leave two simultaneously
   * live tokens), and issues a fresh access token.
   *
   * Reuse of an already-rotated or already-revoked token is rejected with
   * the same generic message a missing/expired token gets — the caller
   * cannot distinguish "never existed" from "was revoked" from "was
   * already rotated", which is deliberate (an attacker who stole an old
   * token gets no signal about why it failed). If the reused token was
   * rotated (`replacedById` set, i.e. superseded rather than logged out),
   * the resulting session it was rotated into is also revoked — a replay
   * of an old token is treated as evidence the whole chain may be
   * compromised.
   */
  async refresh(rawRefreshToken: string): Promise<RefreshSessionIssue> {
    const tokenHash = this.tokenService.hashRefreshToken(rawRefreshToken);

    // Reuse-of-a-rotated-token detection is intentionally read and (when it
    // fires) written OUTSIDE the transaction below. The revocation it
    // performs must survive even though the request as a whole is about to
    // fail — if it ran inside the transaction that later throws, TypeORM
    // would roll the revocation back along with everything else, silently
    // undoing the one write that matters most on this path.
    const initialSession = await this.refreshSessionRepository.findOne({
      where: { tokenHash },
    });

    if (!initialSession) {
      throw new AppException(ErrorCode.Unauthorized, INVALID_REFRESH_MESSAGE);
    }

    if (initialSession.revokedAt !== null) {
      if (initialSession.replacedById) {
        await this.refreshSessionRepository.update(
          { id: initialSession.replacedById, revokedAt: IsNull() },
          { revokedAt: new Date() },
        );
      }
      this.logger.warn(
        `Rejected reuse of a revoked/rotated refresh token for user ${initialSession.userId}`,
      );
      throw new AppException(ErrorCode.Unauthorized, INVALID_REFRESH_MESSAGE);
    }

    return this.transactionService.run(async (manager) => {
      const session = await manager.findOne(RefreshSession, {
        where: { tokenHash },
      });

      if (!session || session.revokedAt !== null) {
        // Revoked/rotated concurrently between the check above and here —
        // treat identically to the reuse case already handled above.
        throw new AppException(ErrorCode.Unauthorized, INVALID_REFRESH_MESSAGE);
      }

      const isExpired = session.expiresAt.getTime() < Date.now();
      if (isExpired) {
        throw new AppException(ErrorCode.Unauthorized, INVALID_REFRESH_MESSAGE);
      }

      const user = await manager.findOne(User, {
        where: { id: session.userId },
      });

      if (!user || user.status !== UserStatus.Active) {
        throw new AppException(ErrorCode.Unauthorized, INVALID_REFRESH_MESSAGE);
      }

      const newRefreshToken = this.tokenService.generateRefreshToken();
      const refreshExpiresAt = this.refreshExpiryDate();

      const newSession = await manager.save(
        manager.create(RefreshSession, {
          userId: user.id,
          tokenHash: this.tokenService.hashRefreshToken(newRefreshToken),
          expiresAt: refreshExpiresAt,
          revokedAt: null,
          replacedById: null,
        }),
      );

      session.revokedAt = new Date();
      session.replacedById = newSession.id;
      await manager.save(session);

      const accessToken = this.tokenService.signAccessToken(user.id);

      return {
        accessToken,
        refreshToken: newRefreshToken,
        refreshExpiresAt,
      };
    });
  }

  /** Called on logout — revokes the session so the refresh cookie (even if retained by the client) can never mint another access token. */
  async revokeRefreshSession(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.tokenService.hashRefreshToken(rawRefreshToken);
    await this.refreshSessionRepository.update(
      { tokenHash, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.findActiveUserOrThrow(userId);

    const currentPasswordValid = await this.passwordService.verify(
      currentPassword,
      user.passwordHash,
    );

    if (!currentPasswordValid) {
      this.logger.warn(
        `Rejected password change for user ${userId}: incorrect current password`,
      );
      throw new AppException(
        ErrorCode.Unauthorized,
        'Current password is incorrect',
      );
    }

    if (!this.passwordService.validatePolicy(newPassword)) {
      throw new AppException(
        ErrorCode.ValidationError,
        'New password does not meet the minimum requirements',
      );
    }

    user.passwordHash = await this.passwordService.hash(newPassword);
    user.passwordChangedAt = new Date();
    await this.userRepository.save(user);
  }

  async forgotPassword(email: string): Promise<void> {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    // Always behave the same way regardless of whether the account exists,
    // so this endpoint cannot be used to enumerate registered emails.
    if (!user || user.status !== UserStatus.Active) {
      return;
    }

    const authConfig = this.configService.get<AuthConfig>('auth')!;
    const rawToken = generateResetToken();
    const tokenHash = hashResetToken(rawToken);
    const expiresAt = new Date(
      Date.now() + authConfig.passwordResetTokenExpiresInMinutes * 60_000,
    );

    const resetToken = this.resetTokenRepository.create({
      userId: user.id,
      tokenHash,
      expiresAt,
      usedAt: null,
    });
    await this.resetTokenRepository.save(resetToken);

    // Delivering the raw token to the user (e.g. via email) is outside
    // Phase 05's scope. It is logged at debug level only for local
    // development so the reset flow can be exercised manually/in tests.
    this.logger.debug(
      `Password reset token generated for user ${user.id} (delivery mechanism not implemented in Phase 05)`,
    );
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    if (!this.passwordService.validatePolicy(newPassword)) {
      throw new AppException(
        ErrorCode.ValidationError,
        'New password does not meet the minimum requirements',
      );
    }

    const tokenHash = hashResetToken(rawToken);

    await this.transactionService.run(async (manager) => {
      const resetToken = await manager.findOne(PasswordResetToken, {
        where: { tokenHash },
      });

      if (
        !resetToken ||
        resetToken.usedAt !== null ||
        resetToken.expiresAt.getTime() < Date.now()
      ) {
        throw new AppException(
          ErrorCode.ValidationError,
          'Invalid or expired reset token',
        );
      }

      const user = await manager.findOne(User, {
        where: { id: resetToken.userId },
      });

      if (!user) {
        throw new AppException(
          ErrorCode.ValidationError,
          'Invalid or expired reset token',
        );
      }

      user.passwordHash = await this.passwordService.hash(newPassword);
      user.passwordChangedAt = new Date();
      await manager.save(user);

      resetToken.usedAt = new Date();
      await manager.save(resetToken);
    });
  }

  private async findActiveUserOrThrow(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user || user.status !== UserStatus.Active) {
      throw new AppException(ErrorCode.Unauthorized, 'Not authenticated');
    }

    return user;
  }
}
