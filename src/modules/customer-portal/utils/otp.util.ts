import { randomInt, createHash } from 'crypto';

const OTP_LENGTH = 6;

/** 6-digit numeric OTP — short enough to type from a Telegram chat, matching typical OTP UX. */
export function generateOtpCode(): string {
  const min = 10 ** (OTP_LENGTH - 1);
  const max = 10 ** OTP_LENGTH;
  return randomInt(min, max).toString();
}

/**
 * SHA-256, not argon2: unlike a password, an OTP's search space is fully
 * known and tiny (10^6) and it expires in minutes, so hash cost buys
 * negligible real protection — what actually stops brute force here is
 * TelegramLinkOtp.attemptCount (see CustomerPortalService) and the short
 * expiry, not hash slowness. Matches PasswordResetToken's own token
 * hashing (SHA-256, not argon2) for the same reason.
 */
export function hashOtpCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}
