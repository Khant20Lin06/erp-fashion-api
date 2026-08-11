import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { UserStatus } from '../../users/entities/user-status.enum';
import { PasswordResetToken } from '../../users/entities/password-reset-token.entity';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { generateResetToken, hashResetToken } from './reset-token.util';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { AuthConfig } from '../../../config/auth.config';
import { toSafeUserDto, SafeUserDto } from '../dto/safe-user.dto';

const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(PasswordResetToken)
    private readonly resetTokenRepository: Repository<PasswordResetToken>,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly transactionService: TransactionService,
    private readonly configService: ConfigService,
  ) {}

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async login(
    email: string,
    plainPassword: string,
  ): Promise<{ user: SafeUserDto; accessToken: string }> {
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
      throw new AppException(
        ErrorCode.Unauthorized,
        INVALID_CREDENTIALS_MESSAGE,
      );
    }

    if (user.status !== UserStatus.Active) {
      throw new AppException(
        ErrorCode.Unauthorized,
        INVALID_CREDENTIALS_MESSAGE,
      );
    }

    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    const accessToken = this.tokenService.signAccessToken(user.id);

    return { user: toSafeUserDto(user), accessToken };
  }

  async getCurrentUser(userId: string): Promise<SafeUserDto> {
    const user = await this.findActiveUserOrThrow(userId);
    return toSafeUserDto(user);
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
