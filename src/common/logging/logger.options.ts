import { Params } from 'nestjs-pino';
import { IncomingMessage, ServerResponse } from 'http';
import { ReqId } from 'pino-http';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/app.config';
import { NodeEnv } from '../../config/env.validation';
import { REQUEST_ID_HEADER } from '../middleware/request-id.middleware';

interface RequestWithId extends IncomingMessage {
  id: ReqId;
  user?: { id?: string };
}

const SENSITIVE_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
];

export function createLoggerOptions(configService: ConfigService): Params {
  const appConfig = configService.get<AppConfig>('app')!;
  const isProduction = appConfig.nodeEnv === NodeEnv.Production;

  return {
    pinoHttp: {
      level: appConfig.logLevel,
      redact: {
        paths: SENSITIVE_PATHS,
        censor: '[REDACTED]',
      },
      genReqId: (req: IncomingMessage) =>
        req.headers[REQUEST_ID_HEADER] as string,
      customProps: (req: RequestWithId) => ({
        service: appConfig.appName,
        environment: appConfig.nodeEnv,
        role: appConfig.appRole,
        userId: req.user?.id,
      }),
      transport: isProduction
        ? undefined
        : {
            target: 'pino-pretty',
            options: {
              singleLine: true,
              colorize: true,
              translateTime: 'SYS:standard',
            },
          },
      autoLogging: appConfig.nodeEnv !== NodeEnv.Test,
      serializers: {
        req: (req: RequestWithId) => ({
          id: req.id,
          method: req.method,
          url: req.url,
        }),
        res: (res: ServerResponse) => ({
          statusCode: res.statusCode,
        }),
      },
    },
  };
}
