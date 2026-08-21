import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('Application Foundation (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health returns 200 with ok status', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'Fashion ERP Backend',
    });
  });

  it('GET /api/v1/health includes a request id response header', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health');

    expect(response.headers['x-request-id']).toBeDefined();
  });

  it('reuses a valid client-supplied request id', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('x-request-id', 'e2e-fixed-request-id');

    expect(response.headers['x-request-id']).toBe('e2e-fixed-request-id');
  });

  it('unversioned/unprefixed route is not found', async () => {
    await request(app.getHttpServer()).get('/health').expect(404);
  });

  it('unknown route returns the standard safe error shape', async () => {
    const response = await request(app.getHttpServer()).get(
      '/api/v1/does-not-exist',
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
      statusCode: 404,
      code: 'NOT_FOUND',
      path: '/api/v1/does-not-exist',
    });
    expect(response.body).toHaveProperty('requestId');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).not.toHaveProperty('stack');
  });
});
