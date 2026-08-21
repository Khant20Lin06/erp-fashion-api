import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  url?: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  poolSize: number;
  logging: boolean;
  connectTimeoutMs?: number;
}

export default registerAs('database', (): DatabaseConfig => {
  const url = process.env.DATABASE_URL?.trim() || undefined;
  const parsedUrl = url ? new URL(url) : null;
  const databaseName = parsedUrl?.pathname?.replace(/^\/+/, '') || '';

  return {
    url,
    host: process.env.DB_HOST ?? parsedUrl?.hostname ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? parsedUrl?.port ?? '3306', 10),
    username:
      process.env.DB_USERNAME ??
      decodeURIComponent(parsedUrl?.username ?? '') ??
      '',
    password:
      process.env.DB_PASSWORD ??
      decodeURIComponent(parsedUrl?.password ?? '') ??
      '',
    database: process.env.DB_DATABASE ?? databaseName,
    poolSize: parseInt(process.env.DB_POOL_SIZE ?? '10', 10),
    logging: process.env.DB_LOGGING === 'true',
    connectTimeoutMs: parseInt(
      process.env.DB_CONNECT_TIMEOUT_MS ?? '10000',
      10,
    ),
  };
});
