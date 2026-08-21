import { createHmac, randomBytes } from 'crypto';

/**
 * HMAC-SHA256 over the exact raw JSON string sent as the request body —
 * never over a re-serialized/re-parsed object, since key ordering or
 * whitespace differences would silently break signature verification on
 * the receiving end. Callers must sign the SAME string they POST.
 */
export function signWebhookPayload(secret: string, rawBody: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

/**
 * Generates a new webhook signing secret. Uses crypto.randomBytes (not
 * crypto.randomUUID) because a signing secret needs more entropy than a
 * UUID's 122 bits are conventionally used for and should not look like an
 * identifier — 32 random bytes hex-encoded (256 bits, matching the
 * HMAC-SHA256 key-size sweet spot).
 */
export function generateWebhookSecret(): string {
  return randomBytes(32).toString('hex');
}
