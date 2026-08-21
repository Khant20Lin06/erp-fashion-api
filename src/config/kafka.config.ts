import { registerAs } from '@nestjs/config';

export interface KafkaConfig {
  brokers: string[];
  clientId: string;
  groupId: string;
  connectionTimeoutMs: number;
  requestTimeoutMs: number;
}

export default registerAs('kafka', (): KafkaConfig => ({
  brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092')
    .split(',')
    .map((broker) => broker.trim())
    .filter((broker) => broker.length > 0),
  clientId: process.env.KAFKA_CLIENT_ID ?? 'fashion-erp-api',
  groupId: process.env.KAFKA_GROUP_ID ?? 'erp-payment-audit-consumer',
  connectionTimeoutMs: parseInt(
    process.env.KAFKA_CONNECTION_TIMEOUT_MS ?? '10000',
    10,
  ),
  requestTimeoutMs: parseInt(
    process.env.KAFKA_REQUEST_TIMEOUT_MS ?? '30000',
    10,
  ),
}));
