/** A single Kafka message handed to a consumer's handler, already decoded from Buffer to string. */
export interface KafkaConsumedMessage {
  topic: string;
  partition: number;
  offset?: string;
  key: string | null;
  value: string | null;
  headers?: Record<string, string | null>;
}

/** A registered consumer's contract — KafkaConsumerService drives one of these per subscribe() call. */
export type KafkaMessageHandler = (
  message: KafkaConsumedMessage,
) => Promise<void>;
