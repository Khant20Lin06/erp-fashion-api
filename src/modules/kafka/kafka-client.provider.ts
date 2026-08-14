import { ConfigService } from '@nestjs/config';
import { Kafka, logLevel } from 'kafkajs';
import { KafkaConfig } from '../../config/kafka.config';

export const KAFKA_CLIENT = Symbol('KAFKA_CLIENT');

/**
 * Builds the single shared kafkajs `Kafka` client instance for this process.
 * Broker addresses/clientId are read exclusively through ConfigService
 * (KafkaConfig, itself sourced from KAFKA_BROKERS/KAFKA_CLIENT_ID env vars)
 * — never hardcoded (locked spec requirement). kafkajs's own logger is
 * dialed down to WARN so routine connect/disconnect noise doesn't flood
 * this codebase's structured pino logging; genuine errors still surface via
 * the producer/consumer wrapper services' own logging.
 */
export function createKafkaClient(configService: ConfigService): Kafka {
  const kafkaConfig = configService.get<KafkaConfig>('kafka')!;
  return new Kafka({
    clientId: kafkaConfig.clientId,
    brokers: kafkaConfig.brokers,
    logLevel: logLevel.WARN,
    retry: {
      initialRetryTime: 300,
      retries: 5,
    },
  });
}
