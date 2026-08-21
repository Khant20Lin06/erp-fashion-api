import { registerAs } from '@nestjs/config';

export interface RedisConfig {
  url: string | undefined;
  host: string;
  port: number;
  password: string | undefined;
  db: number;
  connectTimeoutMs: number;
}

export default registerAs('redis', (): RedisConfig => {
  const url = process.env.REDIS_URL?.trim() || undefined;
  const parsedUrl = url ? new URL(url) : null;
  const pathDb = parsedUrl?.pathname?.replace('/', '') || '';

  return {
    url,
    host: process.env.REDIS_HOST ?? parsedUrl?.hostname ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? parsedUrl?.port ?? '6379', 10),
    password: process.env.REDIS_PASSWORD || parsedUrl?.password || undefined,
    db: parseInt((process.env.REDIS_DB ?? pathDb) || '0', 10),
    connectTimeoutMs: parseInt(
      process.env.REDIS_CONNECT_TIMEOUT_MS ?? '5000',
      10,
    ),
  };
});
