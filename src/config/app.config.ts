import { registerAs } from '@nestjs/config';
import { NodeEnv } from './env.validation';
import { AppRole } from '../shared/utils/runtime-flags';

export interface AppConfig {
  nodeEnv: NodeEnv;
  appRole: AppRole;
  port: number;
  apiPrefix: string;
  apiVersion: string;
  appName: string;
  corsOrigins: string[];
  logLevel: string;
  enableSwagger: boolean;
  swaggerPath: string;
  swaggerJsonPath: string;
  httpBodyLimit: string;
  metricsEnabled: boolean;
  metricsPath: string;
  readinessTimeoutMs: number;
  httpRequestTimeoutMs: number;
  httpKeepAliveTimeoutMs: number;
  httpHeadersTimeoutMs: number;
  /**
   * Express `trust proxy` setting (Phase 20 — Production Infrastructure).
   * Unset/empty by default (no proxy trusted — request.ip is the direct
   * socket peer, safe for local dev and any deployment without a reverse
   * proxy in front of the app). Set to a hop count (e.g. "1" for exactly
   * one reverse proxy) or a comma-separated list of trusted proxy
   * IPs/CIDRs/internal ranges (e.g. "loopback,linklocal,uniquelocal") when
   * deploying behind nginx/Caddy/Traefik/a load balancer — this is what
   * makes `request.ip` (and therefore AuthRateLimitGuard's IP-based
   * identifier, and pino's logged client IP) reflect the real client
   * rather than the proxy's own address. Never set to "true" (trust every
   * hop) in production — that lets a client spoof X-Forwarded-For.
   */
  trustProxy: string | number | boolean;
  rateLimitEnabled: boolean;
  rateLimitMaxRequests: number;
  rateLimitWindowSeconds: number;
}

export default registerAs('app', (): AppConfig => {
  const nodeEnv =
    (process.env.NODE_ENV as NodeEnv | undefined) ?? NodeEnv.Development;
  const appRole = (process.env.APP_ROLE as AppRole | undefined) ?? AppRole.All;
  const enableSwagger =
    process.env.ENABLE_SWAGGER !== undefined
      ? process.env.ENABLE_SWAGGER !== 'false'
      : nodeEnv !== NodeEnv.Production;

  return {
    nodeEnv,
    appRole,
    port: parseInt(process.env.PORT ?? '3000', 10),
    apiPrefix: process.env.API_PREFIX ?? 'api',
    apiVersion: process.env.API_VERSION ?? '1',
    appName: process.env.APP_NAME ?? 'Fashion ERP Backend',
    corsOrigins: (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
    logLevel: process.env.LOG_LEVEL ?? 'info',
    enableSwagger,
    swaggerPath: process.env.SWAGGER_PATH ?? 'docs',
    swaggerJsonPath: process.env.SWAGGER_JSON_PATH ?? 'docs-json',
    httpBodyLimit: process.env.HTTP_BODY_LIMIT ?? '1mb',
    metricsEnabled:
      process.env.METRICS_ENABLED !== undefined
        ? process.env.METRICS_ENABLED !== 'false'
        : nodeEnv !== NodeEnv.Test,
    metricsPath: process.env.METRICS_PATH ?? 'metrics',
    readinessTimeoutMs: parseInt(
      process.env.READINESS_TIMEOUT_MS ?? '3000',
      10,
    ),
    httpRequestTimeoutMs: parseInt(
      process.env.HTTP_REQUEST_TIMEOUT_MS ?? '30000',
      10,
    ),
    httpKeepAliveTimeoutMs: parseInt(
      process.env.HTTP_KEEP_ALIVE_TIMEOUT_MS ?? '5000',
      10,
    ),
    httpHeadersTimeoutMs: parseInt(
      process.env.HTTP_HEADERS_TIMEOUT_MS ?? '60000',
      10,
    ),
    trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
    rateLimitEnabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    rateLimitMaxRequests: parseInt(
      process.env.RATE_LIMIT_MAX_REQUESTS ?? '300',
      10,
    ),
    rateLimitWindowSeconds: parseInt(
      process.env.RATE_LIMIT_WINDOW_SECONDS ?? '60',
      10,
    ),
  };
});

function parseTrustProxy(value: string | undefined): string | number | boolean {
  if (!value || value.trim().length === 0) {
    return false;
  }
  if (value === 'true' || value === 'false') {
    return value === 'true';
  }
  const asNumber = Number(value);
  if (Number.isInteger(asNumber) && asNumber >= 0) {
    return asNumber;
  }
  return value;
}
