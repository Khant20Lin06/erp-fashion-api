import { ConfigService } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import { AppConfig } from '../../config/app.config';

export const OPENAPI_OUTPUT_PATH = join(process.cwd(), 'docs', 'openapi.json');
export const OPENAPI_BEARER_SCHEME = 'bearerAuth';

const PUBLIC_OPERATIONS = new Set([
  'post /api/v1/auth/login',
  'post /api/v1/auth/forgot-password',
  'post /api/v1/auth/reset-password',
  // Authenticates via the httpOnly refresh-token cookie, not a bearer
  // access token — it has no JwtAuthGuard, since its entire purpose is to
  // mint a new access token when the old one has already expired.
  'post /api/v1/auth/refresh',
  'get /api/v1/health',
]);

function normalizeRoutePath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

export function buildOpenApiDocument(
  app: INestApplication,
  configService: ConfigService,
): OpenAPIObject {
  const appConfig = configService.get<AppConfig>('app')!;
  const documentBuilder = new DocumentBuilder()
    .setTitle('Fashion ERP Backend API')
    .setDescription(
      'Production-oriented API contract for the Fashion ERP backend. JWT authentication may be supplied via Authorization Bearer header, while the existing httpOnly cookie flow remains supported for browser clients.',
    )
    .setVersion(`v${appConfig.apiVersion}`)
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Supply a valid JWT access token in the Authorization header as: Bearer <JWT>.',
      },
      OPENAPI_BEARER_SCHEME,
    );

  const document = SwaggerModule.createDocument(app, documentBuilder.build(), {
    deepScanRoutes: true,
  });

  for (const [path, pathItem] of Object.entries(document.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (
        !['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(
          method,
        )
      ) {
        continue;
      }

      if (!operation || typeof operation !== 'object') {
        continue;
      }

      const operationKey = `${method.toLowerCase()} ${normalizeRoutePath(path)}`;
      if (!PUBLIC_OPERATIONS.has(operationKey)) {
        (
          operation as {
            security?: Array<Record<string, string[]>>;
          }
        ).security = [{ [OPENAPI_BEARER_SCHEME]: [] }];
      }
    }
  }

  return document;
}

export function stableSerializeOpenApi(document: OpenAPIObject): string {
  return JSON.stringify(sortDeep(document), null, 2);
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortDeep);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => [key, sortDeep(nested)]),
    );
  }

  return value;
}
