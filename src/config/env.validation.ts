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
});
