import * as Joi from 'joi';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Staging = 'staging',
  Production = 'production',
}

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid(...Object.values(NodeEnv))
    .default(NodeEnv.Development),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string().default('api'),
  API_VERSION: Joi.string().default('1'),
  APP_NAME: Joi.string().default('Fashion ERP Backend'),
  CORS_ORIGINS: Joi.string().allow('').default(''),
  LOG_LEVEL: Joi.string()
    .valid('debug', 'info', 'warn', 'error')
    .default('info'),

  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().port().default(3306),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_DATABASE: Joi.string().required(),
  DB_POOL_SIZE: Joi.number().integer().min(1).default(10),
  DB_LOGGING: Joi.boolean().default(false),

  JWT_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TOKEN_EXPIRES_IN: Joi.string().default('15m'),
  JWT_ISSUER: Joi.string().default('fashion-erp-backend'),
  JWT_AUDIENCE: Joi.string().default('fashion-erp-frontend'),

  AUTH_COOKIE_NAME: Joi.string().default('fashion_erp_access_token'),
  AUTH_COOKIE_SECURE: Joi.boolean().default(true),
  AUTH_COOKIE_SAME_SITE: Joi.string()
    .valid('lax', 'strict', 'none')
    .default('lax'),
  AUTH_COOKIE_DOMAIN: Joi.string().allow('').default(''),
  AUTH_COOKIE_PATH: Joi.string().default('/'),

  PASSWORD_RESET_TOKEN_EXPIRES_IN_MINUTES: Joi.number()
    .integer()
    .min(1)
    .default(30),

  // Kafka (Phase 18 — event transport only, never the source of truth).
  // Never hardcode a broker address in application code — always read
  // these through ConfigService.
  KAFKA_BROKERS: Joi.string().default('localhost:9092'),
  KAFKA_CLIENT_ID: Joi.string().default('fashion-erp-api'),
  KAFKA_GROUP_ID: Joi.string().default('erp-payment-audit-consumer'),

  // Outbox publisher (Phase 18) — polling interval / batch size for the
  // @nestjs/schedule-driven OutboxPublisher.
  OUTBOX_POLL_INTERVAL_MS: Joi.number().integer().min(100).default(5000),
  OUTBOX_BATCH_SIZE: Joi.number().integer().min(1).max(500).default(50),

  // Redis (Phase 19 — cache only, never a source of truth; also reused as
  // the BullMQ connection in Phase 20). REDIS_PASSWORD is optional since
  // the local docker-compose redis service runs without auth; REDIS_DB
  // defaults to logical DB 0.
  REDIS_URL: Joi.string().uri().optional(),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  REDIS_DB: Joi.number().integer().min(0).max(15).default(0),
});
