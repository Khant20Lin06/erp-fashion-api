import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AppConfig } from './config/app.config';
import {
  configureApplication,
  registerSwagger,
} from './bootstrap/configure-app';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(PinoLogger));

  const configService = app.get(ConfigService);
  const appConfig = configService.get<AppConfig>('app')!;

  configureApplication(app, configService);

  app.enableShutdownHooks();

  registerSwagger(app, configService);

  await app.listen(appConfig.port);
  const httpServer = app.getHttpServer() as {
    requestTimeout?: number;
    keepAliveTimeout?: number;
    headersTimeout?: number;
  };
  httpServer.requestTimeout = appConfig.httpRequestTimeoutMs;
  httpServer.keepAliveTimeout = appConfig.httpKeepAliveTimeoutMs;
  httpServer.headersTimeout = appConfig.httpHeadersTimeoutMs;

  const logger = new Logger('Bootstrap');
  logger.log(
    `${appConfig.appName} listening on port ${appConfig.port} [${appConfig.nodeEnv}]`,
  );
  logger.log(
    `API base: /${appConfig.apiPrefix}/v${appConfig.apiVersion} | Swagger: ${appConfig.enableSwagger ? `/${appConfig.swaggerPath}` : 'disabled'}`,
  );
}

bootstrap().catch((error: unknown) => {
  console.error('Fatal error during application bootstrap', error);
  process.exit(1);
});
