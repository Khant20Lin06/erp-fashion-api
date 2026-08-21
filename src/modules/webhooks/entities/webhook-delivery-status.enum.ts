/**
 * PENDING -> DELIVERED (terminal, HTTP 2xx received) or PENDING -> FAILED
 * (terminal, BullMQ's own bounded 5-attempt retry — see QueueService's
 * DEFAULT_JOB_OPTIONS — was exhausted without ever receiving a 2xx).
 * No RETRYING state: retries are BullMQ job re-attempts, not a distinct
 * WebhookDelivery row status — each WebhookDelivery row corresponds to one
 * outbox event delivered to one subscription, and its `attempt` column
 * tracks which BullMQ attempt last wrote to it.
 */
export enum WebhookDeliveryStatus {
  Pending = 'PENDING',
  Delivered = 'DELIVERED',
  Failed = 'FAILED',
}
