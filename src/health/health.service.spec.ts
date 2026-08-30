import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { HealthService } from './health.service';
import { CacheService } from '../modules/redis/cache.service';
import { KafkaProducerService } from '../modules/kafka/kafka-producer.service';
import { QueueService } from '../modules/queue/queue.service';
import { AppConfig } from '../config/app.config';
import { AppRole } from '../shared/utils/runtime-flags';
import { NodeEnv } from '../config/env.validation';

describe('HealthService', () => {
  let service: HealthService;
  let dataSource: jest.Mocked<Pick<DataSource, 'query'>>;
  let cacheService: jest.Mocked<Pick<CacheService, 'isConnected'>>;
  let kafkaProducerService: jest.Mocked<
    Pick<KafkaProducerService, 'isConnected'>
  >;
  let queueService: jest.Mocked<Pick<QueueService, 'isConnected'>>;

  const appConfig: AppConfig = {
    nodeEnv: NodeEnv.Test,
    appRole: AppRole.All,
    port: 3000,
    apiPrefix: 'api',
    apiVersion: '1',
    appName: 'Fashion ERP Backend',
    corsOrigins: [],
    logLevel: 'info',
    enableSwagger: true,
    swaggerPath: 'docs',
    swaggerJsonPath: 'docs-json',
    httpBodyLimit: '1mb',
    metricsEnabled: true,
    metricsPath: 'metrics',
    readinessTimeoutMs: 100,
    httpRequestTimeoutMs: 30000,
    httpKeepAliveTimeoutMs: 5000,
    httpHeadersTimeoutMs: 60000,
    trustProxy: false,
    rateLimitEnabled: true,
    rateLimitMaxRequests: 300,
    rateLimitWindowSeconds: 60,
  };

  beforeEach(() => {
    process.env.APP_ROLE = AppRole.All;

    dataSource = {
      query: jest.fn().mockResolvedValue([{ ok: 1 }]),
    };
    cacheService = {
      isConnected: jest.fn().mockResolvedValue(true),
    };
    kafkaProducerService = {
      isConnected: jest.fn().mockResolvedValue(true),
    };
    queueService = {
      isConnected: jest.fn().mockResolvedValue(true),
    };

    service = new HealthService(
      {
        get: jest.fn().mockReturnValue(appConfig),
      } as unknown as ConfigService,
      dataSource as unknown as DataSource,
      cacheService as unknown as CacheService,
      kafkaProducerService as unknown as KafkaProducerService,
      queueService as unknown as QueueService,
    );
  });

  afterEach(() => {
    delete process.env.APP_ROLE;
  });

  it('treats API role readiness as mysql-only', async () => {
    process.env.APP_ROLE = AppRole.Api;
    cacheService.isConnected.mockResolvedValue(false);
    kafkaProducerService.isConnected.mockResolvedValue(false);
    queueService.isConnected.mockResolvedValue(false);

    await expect(service.getReadinessOrThrow()).resolves.toMatchObject({
      status: 'ready',
      checks: {
        mysql: { status: 'up', required: true },
        redis: { status: 'down', required: false },
        kafka: { status: 'down', required: false },
        bullmq: { status: 'down', required: false },
      },
    });
  });

  it('fails worker readiness when a required dependency is down', async () => {
    process.env.APP_ROLE = AppRole.Worker;
    kafkaProducerService.isConnected.mockResolvedValue(false);

    try {
      await service.getReadinessOrThrow();
      fail('Expected readiness to fail');
    } catch (error) {
      expect(error).toMatchObject({
        response: {
          status: 'not_ready',
          checks: {
            kafka: { status: 'down', required: true },
          },
        },
      });
    }
  });

  it('reports overview as ok even when readiness is false', async () => {
    process.env.APP_ROLE = AppRole.Worker;
    kafkaProducerService.isConnected.mockResolvedValue(false);

    const result = await service.getOverview();

    expect(result.status).toBe('ok');
    expect(result.ready).toBe(false);
    expect(result.kafka).toBe('down');
  });
});
