import { registerAs } from '@nestjs/config';

export interface OutboxConfig {
  pollIntervalMs: number;
  batchSize: number;
}

export default registerAs('outbox', (): OutboxConfig => ({
  pollIntervalMs: parseInt(process.env.OUTBOX_POLL_INTERVAL_MS ?? '5000', 10),
  batchSize: parseInt(process.env.OUTBOX_BATCH_SIZE ?? '50', 10),
}));
