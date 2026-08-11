import {
  Body,
  Controller,
  INestApplication,
  Post,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { IsEmail, IsNotEmpty } from 'class-validator';
import request from 'supertest';
import { App } from 'supertest/types';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter';

class SampleValidationDto {
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  name!: string;
}

@Controller('test-validation')
class SampleValidationController {
  @Post()
  create(@Body() dto: SampleValidationDto): SampleValidationDto {
    return dto;
  }
}

describe('Global validation pipe (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [SampleValidationController],
    }).compile();

    app = moduleFixture.createNestApplication();
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

  it('rejects an invalid request body with a safe validation error', async () => {
    const response = await request(app.getHttpServer())
      .post('/test-validation')
      .send({ email: 'not-an-email' });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  });

  it('rejects unknown properties not defined on the DTO', async () => {
    const response = await request(app.getHttpServer())
      .post('/test-validation')
      .send({ email: 'user@example.com', name: 'User', extraField: 'x' });

    expect(response.status).toBe(400);
  });

  it('accepts a valid request body', async () => {
    const response = await request(app.getHttpServer())
      .post('/test-validation')
      .send({ email: 'user@example.com', name: 'User' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      email: 'user@example.com',
      name: 'User',
    });
  });
});
