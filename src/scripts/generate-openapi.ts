import { mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { pathToFileURL } from 'url';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { configureApplication } from '../bootstrap/configure-app';
import {
  buildOpenApiDocument,
  OPENAPI_OUTPUT_PATH,
  stableSerializeOpenApi,
} from '../common/swagger/openapi';

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
    const serialized = stableSerializeOpenApi(document);

    await mkdir(dirname(OPENAPI_OUTPUT_PATH), { recursive: true });
    await writeFile(OPENAPI_OUTPUT_PATH, `${serialized}\n`, 'utf8');
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error('Failed to generate OpenAPI document', error);
  process.exit(1);
});
