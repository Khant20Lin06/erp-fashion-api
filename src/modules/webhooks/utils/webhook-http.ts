import { signWebhookPayload } from './webhook-signature';

const REQUEST_TIMEOUT_MS = 10_000;

export interface WebhookPostResult {
  status: number;
  body: string | null;
}

/**
 * The single, shared "sign and POST" implementation used by BOTH
 * WebhookDeliveryWorker (real production deliveries) and
 * WebhookSubscriptionsService.sendTestDelivery() (the /webhooks/:id/test
 * endpoint) — the phase's own "must use the same signing and delivery
 * path as production if possible" requirement, satisfied by literally
 * sharing this function rather than two parallel implementations.
 */
export async function postSignedWebhook(
  url: string,
  secret: string,
  rawBody: string,
): Promise<WebhookPostResult> {
  const signature = signWebhookPayload(secret, rawBody);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
      },
      body: rawBody,
      signal: controller.signal,
    });
    const text = await response.text().catch(() => '');
    return { status: response.status, body: text ? text.slice(0, 1000) : null };
  } finally {
    clearTimeout(timeout);
  }
}
