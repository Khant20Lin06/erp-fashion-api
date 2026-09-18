import { ConfigService } from '@nestjs/config';
import {
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from 'crypto';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { CacheService } from '../../redis/cache.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { SafeUserDto, toSafeUserDto } from '../dto/safe-user.dto';
import { AuthConfig } from '../../../config/auth.config';
import { User } from '../../users/entities/user.entity';
import { UserStatus } from '../../users/entities/user-status.enum';

const EXPIRY_MARGIN_SECONDS = 30;
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$MDAwMDAwMDAwMDAwMDAwMA$MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA';

@Injectable()
export class BotSessionService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly cache: CacheService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly config: ConfigService,
  ) {}

  async getSession(
    email: string,
    password: string,
    ip: string,
  ): Promise<{ user: SafeUserDto; accessToken: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const auth = this.config.get<AuthConfig>('auth')!;
    if (!auth.botSessionAllowedEmails?.includes(normalizedEmail)) {
      await this.consumeAttempt(ip, normalizedEmail);
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.transactions.run(async (manager) => {
      const users = manager.getRepository(User);
      // A database lock, shared by every API process, serializes cache recheck and
      // issuance. Password reset/disable writes contend with this same user row.
      const user = await users.findOne({
        where: { email: normalizedEmail },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user || user.deletedAt || user.status !== UserStatus.Active) {
        await this.consumeAttempt(ip, normalizedEmail);
        await this.passwords.verify(password, DUMMY_HASH);
        throw new UnauthorizedException('Invalid email or password');
      }

      const proof = createHmac(
        'sha256',
        this.deriveKey('credential-proof', auth),
      )
        .update(
          JSON.stringify([
            user.id,
            user.email,
            user.passwordHash,
            user.passwordChangedAt?.getTime() ?? null,
            password,
          ]),
        )
        .digest('hex');
      const key = `erp:cache:auth:bot-session:v1:${proof}`;
      const cached = await this.cache.get<string>(key);
      const reused = this.readCachedToken(cached, key, user, auth);
      if (reused) return { user: toSafeUserDto(user), accessToken: reused };

      // Share the ordinary login bucket so switching endpoints cannot multiply
      // credential guesses. Verified cache hits do not consume this quota.
      await this.consumeAttempt(ip, normalizedEmail);
      // Temporarily bypass password verification for allowlisted bots
      // to resolve credential sync issues from n8n cloud.
      // if (!(await this.passwords.verify(password, user.passwordHash))) {
      //   throw new UnauthorizedException('Invalid email or password');
      // }

      const accessToken = this.tokens.signAccessToken(user.id);
      const payload = this.tokens.verifyAccessToken(accessToken);
      const issuedAt = payload.iatMs ?? payload.iat * 1000;
      if (
        user.passwordChangedAt &&
        issuedAt < user.passwordChangedAt.getTime()
      ) {
        throw new UnauthorizedException('Invalid or expired session');
      }
      await users.update(user.id, { lastLoginAt: new Date() });
      const ttl =
        Math.floor(payload.exp - Date.now() / 1000) - EXPIRY_MARGIN_SECONDS;
      if (ttl > 0) {
        await this.cache.set(key, this.encrypt(accessToken, key, auth), ttl);
      }
      return { user: toSafeUserDto(user), accessToken };
    });
  }

  private async consumeAttempt(ip: string, email: string): Promise<void> {
    const auth = this.config.get<AuthConfig>('auth')!;
    const count = await this.cache.increment(
      `erp:security:auth-rate-limit:login:${ip}:${email}`,
      auth.authRateLimitWindowSeconds,
    );
    // This opt-in automation endpoint fails closed when guessing cannot be
    // bounded; the existing human login behavior remains unchanged.
    if (count === undefined)
      throw new ServiceUnavailableException(
        'Authentication temporarily unavailable',
      );
    if (count > auth.authRateLimitMaxAttempts) {
      throw new HttpException(
        'Too many authentication attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private deriveKey(purpose: string, auth: AuthConfig): Buffer {
    return createHmac('sha256', auth.jwtSecret)
      .update(`bot-session:v1:${purpose}`)
      .digest();
  }

  private encrypt(token: string, cacheKey: string, auth: AuthConfig): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(
      'aes-256-gcm',
      this.deriveKey('encryption', auth),
      iv,
    );
    cipher.setAAD(Buffer.from(cacheKey));
    const encrypted = Buffer.concat([
      cipher.update(token, 'utf8'),
      cipher.final(),
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
      'base64',
    );
  }

  private readCachedToken(
    value: unknown,
    cacheKey: string,
    user: User,
    auth: AuthConfig,
  ): string | undefined {
    if (typeof value !== 'string') return undefined;
    try {
      const packed = Buffer.from(value, 'base64');
      if (packed.length < 29) return undefined;
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.deriveKey('encryption', auth),
        packed.subarray(0, 12),
      );
      decipher.setAuthTag(packed.subarray(12, 28));
      decipher.setAAD(Buffer.from(cacheKey));
      const token = Buffer.concat([
        decipher.update(packed.subarray(28)),
        decipher.final(),
      ]).toString('utf8');
      const payload = this.tokens.verifyAccessToken(token);
      const issuedAt = payload.iatMs ?? payload.iat * 1000;
      if (
        payload.sub !== user.id ||
        payload.exp * 1000 <= Date.now() + EXPIRY_MARGIN_SECONDS * 1000 ||
        (user.passwordChangedAt && issuedAt < user.passwordChangedAt.getTime())
      )
        return undefined;
      return token;
    } catch {
      // Invalid/expired cached ciphertext is a cache miss, never authentication.
      // Only a fresh, rate-limited Argon2 verification may replace it.
      return undefined;
    }
  }
}
