/**
 * Mirrors NotificationJobData exactly — the job carries only the id of the
 * durable row it must process; the worker always re-reads that row rather
 * than trusting stale job payload data.
 */
export interface WebhookDeliveryJobData extends Record<string, unknown> {
  webhookDeliveryId: string;
  correlationId?: string | null;
}

export const DELIVER_WEBHOOK_JOB = 'deliver-webhook';
