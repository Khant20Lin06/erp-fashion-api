import { registerAs } from '@nestjs/config';
import { NodeEnv } from './env.validation';

export interface AppConfig {
  nodeEnv: NodeEnv;
  port: number;
  apiPrefix: string;
  apiVersion: string;
  appName: string;
  corsOrigins: string[];
  logLevel: string;
}

export default registerAs('app', (): AppConfig => ({
  nodeEnv: (process.env.NODE_ENV as NodeEnv) ?? NodeEnv.Development,
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api',
  apiVersion: process.env.API_VERSION ?? '1',
  appName: process.env.APP_NAME ?? 'Fashion ERP Backend',
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0),
  logLevel: process.env.LOG_LEVEL ?? 'info',
}));
