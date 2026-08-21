import { registerAs } from '@nestjs/config';

export interface QueueConfig {
  notificationWorkerConcurrency: number;
  webhookWorkerConcurrency: number;
  aiIngestionWorkerConcurrency: number;
}

export default registerAs('queue', (): QueueConfig => ({
  notificationWorkerConcurrency: parseInt(
    process.env.NOTIFICATION_WORKER_CONCURRENCY ?? '3',
    10,
  ),
  webhookWorkerConcurrency: parseInt(
    process.env.WEBHOOK_WORKER_CONCURRENCY ?? '3',
    10,
  ),
  aiIngestionWorkerConcurrency: parseInt(
    process.env.AI_INGESTION_WORKER_CONCURRENCY ?? '2',
    10,
  ),
}));
