import { randomBytes, createHash } from 'crypto';

const RESET_TOKEN_BYTES = 32;

export function generateResetToken(): string {
  return randomBytes(RESET_TOKEN_BYTES).toString('hex');
}

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
