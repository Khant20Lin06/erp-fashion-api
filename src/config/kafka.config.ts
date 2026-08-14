import { registerAs } from '@nestjs/config';

export interface KafkaConfig {
  brokers: string[];
  clientId: string;
  groupId: string;
}

export default registerAs('kafka', (): KafkaConfig => ({
  brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092')
    .split(',')
    .map((broker) => broker.trim())
    .filter((broker) => broker.length > 0),
  clientId: process.env.KAFKA_CLIENT_ID ?? 'fashion-erp-api',
  groupId: process.env.KAFKA_GROUP_ID ?? 'erp-payment-audit-consumer',
}));
