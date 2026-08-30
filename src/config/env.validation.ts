import * as Joi from 'joi';
import { AppRole } from '../shared/utils/runtime-flags';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Staging = 'staging',
  Production = 'production',
}

interface ValidatedEnvironment {
  NODE_ENV: NodeEnv;
  JWT_SECRET?: string;
  AUTH_COOKIE_SECURE?: boolean;
}

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid(...Object.values(NodeEnv))
    .default(NodeEnv.Development),
  APP_ROLE: Joi.string()
    .valid(...Object.values(AppRole))
    .default(AppRole.All),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string().default('api'),
  API_VERSION: Joi.string().default('1'),
  APP_NAME: Joi.string().default('Fashion ERP Backend'),
  CORS_ORIGINS: Joi.string().allow('').default(''),
  LOG_LEVEL: Joi.string()
    .valid('debug', 'info', 'warn', 'error')
    .default('info'),
  ENABLE_SWAGGER: Joi.boolean().optional(),
  SWAGGER_PATH: Joi.string().default('docs'),
  SWAGGER_JSON_PATH: Joi.string().default('docs-json'),
  HTTP_BODY_LIMIT: Joi.string().default('1mb'),
  METRICS_ENABLED: Joi.boolean().default(true),
  METRICS_PATH: Joi.string().default('metrics'),
  READINESS_TIMEOUT_MS: Joi.number().integer().min(100).default(3000),
  HTTP_REQUEST_TIMEOUT_MS: Joi.number().integer().min(1000).default(30000),
  HTTP_KEEP_ALIVE_TIMEOUT_MS: Joi.number().integer().min(1000).default(5000),
  HTTP_HEADERS_TIMEOUT_MS: Joi.number().integer().min(1000).default(60000),
  // Express `trust proxy` (Phase 20 — Production Infrastructure). Empty by
  // default (no proxy trusted). Set a hop count ("1") or a trusted-source
  // list ("loopback,linklocal,uniquelocal") when deployed behind a reverse
  // proxy — see app.config.ts's own docblock for the full rationale.
  TRUST_PROXY: Joi.string().allow('').default(''),

  DATABASE_URL: Joi.string().uri().allow('').optional(),
  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().port().default(3306),
  // `is: Joi.string().min(1)` — not `Joi.exist()` — deliberately: an empty
  // DATABASE_URL="" is present-but-useless, and Joi.exist() alone treats
  // that as "provided", which would make DB_USERNAME/PASSWORD/DATABASE all
  // optional even though there is no real connection string to fall back
  // on. Reproduced live: a fresh .env.example copy ships DATABASE_URL=
  // (blank) alongside real DB_USERNAME/DB_PASSWORD/DB_DATABASE values —
  // those must still be required in that case, not silently waived.
  DB_USERNAME: Joi.string().when('DATABASE_URL', {
    is: Joi.string().min(1),
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),
  DB_PASSWORD: Joi.string().when('DATABASE_URL', {
    is: Joi.string().min(1),
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),
  DB_DATABASE: Joi.string().when('DATABASE_URL', {
    is: Joi.string().min(1),
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),
  DB_POOL_SIZE: Joi.number().integer().min(1).default(10),
  DB_LOGGING: Joi.boolean().default(false),
  DB_CONNECT_TIMEOUT_MS: Joi.number().integer().min(1000).default(10000),

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
  AUTH_RATE_LIMIT_MAX_ATTEMPTS: Joi.number().integer().min(1).default(10),
  AUTH_RATE_LIMIT_WINDOW_SECONDS: Joi.number().integer().min(1).default(60),

  // Global API rate limiting (Phase 21 addendum). Applies to every request
  // as an IP-based floor against blunt-force flooding/DoS — separate from
  // AuthRateLimitGuard (per-identity, auth-endpoint-specific, much
  // stricter) and from any per-route override (e.g. AI chat, reports).
  RATE_LIMIT_ENABLED: Joi.boolean().default(true),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().integer().min(1).default(300),
  RATE_LIMIT_WINDOW_SECONDS: Joi.number().integer().min(1).default(60),

  // Kafka (Phase 18 — event transport only, never the source of truth).
  // Never hardcode a broker address in application code — always read
  // these through ConfigService.
  KAFKA_BROKERS: Joi.string().default('localhost:9092'),
  KAFKA_CLIENT_ID: Joi.string().default('fashion-erp-api'),
  KAFKA_GROUP_ID: Joi.string().default('erp-payment-audit-consumer'),
  KAFKA_CONNECTION_TIMEOUT_MS: Joi.number().integer().min(1000).default(10000),
  KAFKA_REQUEST_TIMEOUT_MS: Joi.number().integer().min(1000).default(30000),

  // Outbox publisher (Phase 18) — polling interval / batch size for the
  // @nestjs/schedule-driven OutboxPublisher.
  OUTBOX_POLL_INTERVAL_MS: Joi.number().integer().min(100).default(5000),
  OUTBOX_BATCH_SIZE: Joi.number().integer().min(1).max(500).default(50),

  // Redis (Phase 19 — cache only, never a source of truth; also reused as
  // the BullMQ connection in Phase 20). REDIS_PASSWORD is optional since
  // the local docker-compose redis service runs without auth; REDIS_DB
  // defaults to logical DB 0.
  REDIS_URL: Joi.string().uri().allow('').optional(),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  REDIS_DB: Joi.number().integer().min(0).max(15).default(0),
  REDIS_CONNECT_TIMEOUT_MS: Joi.number().integer().min(1000).default(5000),

  NOTIFICATION_WORKER_CONCURRENCY: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(3),

  // Webhook delivery worker (Phase 23 — Integrations/Webhooks)
  WEBHOOK_WORKER_CONCURRENCY: Joi.number().integer().min(1).max(100).default(3),

  // AI Assistant / RAG (Phase 19). AI_ENABLED gates the entire feature —
  // with no provider configured the ERP remains fully functional; all AI
  // routes/workers become inert rather than throwing at every request. No
  // default for AI_BASE_URL/AI_API_KEY/AI_CHAT_MODEL/AI_EMBEDDING_MODEL —
  // never assume a specific provider.
  AI_ENABLED: Joi.boolean().default(false),
  AI_PROVIDER: Joi.string().default('openai-compatible'),
  // .allow('') on every one of these: .env.example ships them all blank
  // (never a default provider assumed), and Joi's .optional() alone
  // rejects an explicit empty string — only an ABSENT key, not a blank
  // one. Without .allow(''), copying .env.example verbatim crashes
  // startup with "is not allowed to be empty" (reproduced live twice this
  // project — see AI_EMBEDDING_MODEL's original single-var version of
  // this same bug, now generalized to every optional AI/Ollama var here).
  AI_BASE_URL: Joi.string().uri().allow('').optional(),
  AI_API_KEY: Joi.string().allow('').optional(),
  AI_CHAT_MODEL: Joi.string().allow('').optional(),
  AI_EMBEDDING_MODEL: Joi.string().allow('').optional(),
  // A chat provider often doesn't serve embeddings at all (OpenRouter has
  // no /embeddings endpoint) — these default to AI_BASE_URL/AI_API_KEY
  // when unset, but let a deployment point embeddings at a different
  // provider entirely (e.g. OpenAI direct) while chat stays on OpenRouter.
  AI_EMBEDDING_BASE_URL: Joi.string().uri().allow('').optional(),
  AI_EMBEDDING_API_KEY: Joi.string().allow('').optional(),
  // Optional local LLM tier (Phase 19.1 — HybridLlmProvider), an
  // Ollama-compatible HTTP server. No API key concept for Ollama itself.
  // Entirely optional — the app must start and AI chat must still work
  // (via the deterministic fallback) if these are unset or unreachable.
  OLLAMA_BASE_URL: Joi.string().uri().allow('').optional(),
  OLLAMA_CHAT_MODEL: Joi.string().allow('').optional(),
  OLLAMA_EMBEDDING_MODEL: Joi.string().allow('').optional(),
  // Whether HybridLlmProvider may fall through to the API-key-free
  // deterministic LocalFallbackProvider when remote/local LLM tiers are
  // unavailable. True by default per Phase 19.1's hard requirement that
  // the assistant remain usable without any external API key.
  AI_FALLBACK_ENABLED: Joi.boolean().default(true),
  AI_REQUEST_TIMEOUT_MS: Joi.number().integer().min(1000).default(30000),
  AI_MAX_HISTORY_MESSAGES: Joi.number().integer().min(1).max(200).default(20),
  AI_RAG_TOP_K: Joi.number().integer().min(1).max(50).default(5),
  AI_CHUNK_SIZE: Joi.number().integer().min(100).max(8000).default(1000),
  AI_CHUNK_OVERLAP: Joi.number().integer().min(0).max(2000).default(150),
  AI_CHAT_RATE_LIMIT_PER_MINUTE: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .default(10),
  AI_INGESTION_WORKER_CONCURRENCY: Joi.number()
    .integer()
    .min(1)
    .max(20)
    .default(2),
  // Vector search for AI Assistant RAG (Phase 19.1 follow-up). Unset is
  // valid — AiRagService returns no retrieved chunks rather than throwing,
  // same degrade-gracefully convention as every other optional AI tier.
  QDRANT_URL: Joi.string().uri().allow('').optional(),
  QDRANT_COLLECTION: Joi.string().optional(),
  QDRANT_REQUEST_TIMEOUT_MS: Joi.number().integer().min(1000).default(10000),
}).custom((rawValue, helpers) => {
  const value = rawValue as ValidatedEnvironment;
  if (
    value.NODE_ENV === NodeEnv.Production &&
    typeof value.JWT_SECRET === 'string' &&
    value.JWT_SECRET.includes('replace-this-with-a-random-secret')
  ) {
    return helpers.error('any.invalid', {
      message: 'JWT_SECRET placeholder is not allowed in production',
    });
  }

  if (
    value.NODE_ENV === NodeEnv.Production &&
    value.AUTH_COOKIE_SECURE === false
  ) {
    return helpers.error('any.invalid', {
      message: 'AUTH_COOKIE_SECURE must remain true in production',
    });
  }

  return value;
});
