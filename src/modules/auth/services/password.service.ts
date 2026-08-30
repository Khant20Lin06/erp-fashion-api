import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128;

/**
 * Small, dependency-free denylist of the passwords most commonly seen in
 * credential-stuffing lists. Not a HIBP-style breached-password check (that
 * would need an external service/dataset this project doesn't have wired
 * up) — this only blocks the handful of trivially-guessable values that a
 * length-only policy lets straight through (e.g. "password1234").
 */
const COMMON_WEAK_PASSWORDS = new Set([
  'password',
  'password123',
  'password1234',
  '12345678',
  '123456789',
  '1234567890',
  'qwertyuiop',
  'letmein123',
  'welcome123',
  'admin1234',
  'iloveyou1',
]);

@Injectable()
export class PasswordService {
  async hash(plainPassword: string): Promise<string> {
    return hash(plainPassword);
  }

  async verify(plainPassword: string, passwordHash: string): Promise<boolean> {
    return verify(passwordHash, plainPassword);
  }

  /**
   * Length + minimal character-class diversity (OWASP ASVS-aligned
   * baseline: length is the strongest single predictor of strength, so the
   * floor is raised rather than relying on complexity rules alone) plus a
   * denylist of the most common weak passwords. This is not a full
   * breached-password/entropy check — see the module docblock.
   */
  validatePolicy(plainPassword: string): boolean {
    if (
      plainPassword.length < MIN_PASSWORD_LENGTH ||
      plainPassword.length > MAX_PASSWORD_LENGTH
    ) {
      return false;
    }

    if (COMMON_WEAK_PASSWORDS.has(plainPassword.toLowerCase())) {
      return false;
    }

    const hasLetter = /[a-zA-Z]/.test(plainPassword);
    const hasDigitOrSymbol = /[\d\W]/.test(plainPassword);

    return hasLetter && hasDigitOrSymbol;
  }
}
