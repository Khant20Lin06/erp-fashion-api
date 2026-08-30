import { readFile } from 'fs/promises';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { configureApplication } from '../bootstrap/configure-app';
import {
  createScriptLogger,
  logScriptFailure,
} from '../common/logging/script-logger';
import {
  buildOpenApiDocument,
  OPENAPI_OUTPUT_PATH,
  stableSerializeOpenApi,
} from '../common/swagger/openapi';

const logger = createScriptLogger('ValidateOpenApiScript');

async function main(): Promise<void> {
  process.env.OPENAPI_GENERATION_MODE = 'true';
  process.env.KAFKAJS_NO_PARTITIONER_WARNING = '1';
  const appModuleUrl = pathToFileURL(
    join(__dirname, '..', 'app.module.js'),
  ).href;

  const { AppModule } = (await import(appModuleUrl)) as {
    AppModule: Parameters<typeof NestFactory.create>[0];
  };
  const app = await NestFactory.create(AppModule, { logger: false });

  try {
    const configService = app.get(ConfigService);
    configureApplication(app, configService);
    const document = buildOpenApiDocument(app, configService);
    const expected = stableSerializeOpenApi(document).trim();
    const actual = (await readFile(OPENAPI_OUTPUT_PATH, 'utf8')).trim();

    if (actual !== expected) {
      throw new Error(
        `OpenAPI document is stale. Re-run npm run openapi:generate to refresh ${OPENAPI_OUTPUT_PATH}.`,
      );
    }

    if (!document.paths['/api/v1/health']) {
      throw new Error('OpenAPI document is missing GET /api/v1/health.');
    }

    if (!document.components?.securitySchemes?.bearerAuth) {
      throw new Error(
        'OpenAPI document is missing the bearerAuth security scheme.',
      );
    }

    const loginOperation = document.paths['/api/v1/auth/login']?.post;
    if (loginOperation?.security?.length) {
      throw new Error(
        'POST /api/v1/auth/login must remain a public OpenAPI operation.',
      );
    }

    const protectedOperation = document.paths['/api/v1/auth/me']?.get;
    if (!protectedOperation?.security?.length) {
      throw new Error(
        'GET /api/v1/auth/me must be marked as protected in OpenAPI.',
      );
    }
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  logScriptFailure('Failed to validate OpenAPI document', error, logger);
  process.exit(1);
});
