import { ConfigService } from '@nestjs/config';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import {
  Application,
  json,
  NextFunction,
  Request,
  Response,
  urlencoded,
  static as expressStatic,
} from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import * as path from 'path';
import * as fs from 'fs';
import { GlobalExceptionFilter } from '../common/filters/http-exception.filter';
import { AppConfig } from '../config/app.config';
import { buildOpenApiDocument } from '../common/swagger/openapi';
import { SwaggerModule } from '@nestjs/swagger';
import { MetricsService } from '../observability/metrics/metrics.controller';
import { AppRole, getAppRole } from '../shared/utils/runtime-flags';

/**
 * Route prefixes that remain reachable on a `worker` role process. A worker
 * process only exists so BullMQ/Kafka consumers can run and so container
 * orchestration can probe it — it must never expose the public business API
 * or Swagger/docs surface (see AppRole in shared/utils/runtime-flags.ts).
 */
const WORKER_ROLE_ALLOWED_PATH_SEGMENTS = ['health', 'metrics'];

export function configureApplication(
  app: INestApplication,
  configService: ConfigService,
): void {
  const appConfig = configService.get<AppConfig>('app')!;

  const expressInstance = app.getHttpAdapter().getInstance() as Application;
  expressInstance.set('trust proxy', appConfig.trustProxy);

  app.setGlobalPrefix(appConfig.apiPrefix);
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: appConfig.apiVersion,
  });

  app.use(json({ limit: appConfig.httpBodyLimit }));
  app.use(urlencoded({ extended: true, limit: appConfig.httpBodyLimit }));

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: appConfig.corsOrigins.length > 0 ? appConfig.corsOrigins : false,
    credentials: true,
  });

  // Serve static uploads
  const uploadPath = path.resolve(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }
  app.use('/uploads', expressStatic(uploadPath));

  if (getAppRole() === AppRole.Worker) {
    restrictHttpSurfaceToWorkerRole(app, appConfig);
  }

  const metricsService = app.get(MetricsService);
  const metricsPath = trimLeadingSlash(appConfig.metricsPath);
  if (appConfig.metricsEnabled && metricsPath.length > 0) {
    const expressApp = app.getHttpAdapter().getInstance() as Application;
    expressApp.get(`/${metricsPath}`, async (_req: Request, res: Response) => {
      res.type('text/plain; version=0.0.4; charset=utf-8');
      res.send(await metricsService.render());
    });
  }
}

/**
 * A `worker` role process still runs an HTTP listener (container
 * orchestration needs `/health/live` and `/health/ready` to gate traffic
 * and restarts, and `/metrics` for scraping) but must not expose the public
 * business API surface. Rather than splitting the Nest module graph per
 * role — which would risk breaking DI for the Kafka/BullMQ consumers that
 * live alongside the HTTP controllers — this middleware runs first and
 * short-circuits every request outside the allowed health/metrics prefixes
 * with a plain 404, before it ever reaches a business controller, guard, or
 * Swagger. It preserves the exact same "not found" contract normal unknown
 * routes get, revealing nothing about which routes are suppressed.
 */
function restrictHttpSurfaceToWorkerRole(
  app: INestApplication,
  appConfig: AppConfig,
): void {
  const apiPrefix = trimLeadingSlash(appConfig.apiPrefix);
  const allowedPrefixes = WORKER_ROLE_ALLOWED_PATH_SEGMENTS.flatMap(
    (segment) => [
      `/${segment}`,
      `/${apiPrefix}/${segment}`,
      new RegExp(`^/${apiPrefix}/v[^/]+/${segment}(/|$)`),
    ],
  );

  app.use((req: Request, res: Response, next: NextFunction) => {
    const path = req.path;
    const isAllowed = allowedPrefixes.some((prefix) =>
      typeof prefix === 'string'
        ? path === prefix || path.startsWith(`${prefix}/`)
        : prefix.test(path),
    );

    if (isAllowed) {
      next();
      return;
    }

    res.status(404).json({
      success: false,
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Cannot ' + req.method + ' ' + req.originalUrl,
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    });
  });
}

export function registerSwagger(
  app: INestApplication,
  configService: ConfigService,
): void {
  const appConfig = configService.get<AppConfig>('app')!;
  if (!appConfig.enableSwagger || getAppRole() === AppRole.Worker) {
    return;
  }

  const swaggerPath = trimLeadingSlash(appConfig.swaggerPath);
  const swaggerJsonPath = trimLeadingSlash(appConfig.swaggerJsonPath);
  const legacySwaggerPath = `${trimLeadingSlash(appConfig.apiPrefix)}/${swaggerPath}`;
  const legacySwaggerJsonPath = `${trimLeadingSlash(appConfig.apiPrefix)}/${swaggerJsonPath}`;
  const document = buildOpenApiDocument(app, configService);

  SwaggerModule.setup(swaggerPath, app, document, {
    jsonDocumentUrl: swaggerJsonPath,
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  if (legacySwaggerPath !== swaggerPath) {
    SwaggerModule.setup(legacySwaggerPath, app, document, {
      jsonDocumentUrl: legacySwaggerJsonPath,
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }
}

function trimLeadingSlash(value: string): string {
  return value.replace(/^\/+/, '');
}
