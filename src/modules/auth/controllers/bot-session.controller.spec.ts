import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Server } from 'node:http';
import { BotSessionController } from './bot-session.controller';
import { BotSessionService } from '../services/bot-session.service';

describe('Bot-session HTTP contract', () => {
  let app: INestApplication<Server>;
  const getSession = jest.fn();
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [BotSessionController],
      providers: [
        { provide: BotSessionService, useValue: { getSession } },
        {
          provide: ConfigService,
          useValue: {
            get: () => ({
              cookieName: 'fashion_erp_access_token',
              cookieSecure: true,
              cookieSameSite: 'lax',
              cookiePath: '/',
            }),
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });
  beforeEach(() =>
    getSession
      .mockReset()
      .mockResolvedValue({ user: { id: 'bot' }, accessToken: 'secret-access' }),
  );
  afterAll(async () => {
    await app.close();
  });

  it('returns only the safe user and an HttpOnly access cookie with no refresh cookie', async () => {
    const result = await request(app.getHttpServer())
      .post('/api/v1/auth/bot-session')
      .send({ email: 'bot@example.test', password: 'test-only-password' });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ user: { id: 'bot' } });
    expect(result.headers['cache-control']).toBe('no-store');
    const cookies = result.headers['set-cookie'] as unknown as string[];
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatch(/^fashion_erp_access_token=secret-access;/);
    expect(cookies[0]).toContain('HttpOnly');
    expect(cookies[0]).toContain('Secure');
    expect(cookies[0]).toContain('SameSite=Lax');
    expect(JSON.stringify(result.body)).not.toContain('secret-access');
  });

  it.each([
    {},
    { email: 'invalid', password: 'x' },
    { email: 'bot@example.test', password: '' },
    { email: 'bot@example.test', password: 'x', userId: 'another-user' },
  ])(
    'rejects invalid or extra input without issuing cookies (%j)',
    async (body) => {
      const result = await request(app.getHttpServer())
        .post('/api/v1/auth/bot-session')
        .send(body);
      expect(result.status).toBe(400);
      expect(result.headers['set-cookie']).toBeUndefined();
    },
  );
});
