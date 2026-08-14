import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthController } from './health.controller';
import { AppConfig } from '../config/app.config';
import { KafkaProducerService } from '../modules/kafka/kafka-producer.service';
import { CacheService } from '../modules/redis/cache.service';

describe('HealthController', () => {
  let controller: HealthController;
  let kafkaProducerService: { isConnected: jest.Mock };
  let cacheService: { isConnected: jest.Mock };

  const mockAppConfig: AppConfig = {
    nodeEnv: 'test' as AppConfig['nodeEnv'],
    port: 4000,
    apiPrefix: 'api',
    apiVersion: '1',
    appName: 'Fashion ERP Backend',
    corsOrigins: [],
    logLevel: 'info',
  };

  beforeEach(async () => {
    kafkaProducerService = { isConnected: jest.fn().mockResolvedValue(true) };
    cacheService = { isConnected: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(mockAppConfig),
          },
        },
        {
          provide: KafkaProducerService,
          useValue: kafkaProducerService,
        },
        {
          provide: CacheService,
          useValue: cacheService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return ok status with service and environment', async () => {
    const result = await controller.check();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('fashion-erp-backend');
    expect(result.environment).toBe('test');
    expect(result.timestamp).toBeDefined();
  });

  it('should report kafka connectivity without affecting overall status', async () => {
    kafkaProducerService.isConnected.mockResolvedValue(false);

    const result = await controller.check();

    expect(result.status).toBe('ok');
    expect(result.kafka).toBe('down');
  });

  it('should report redis connectivity without affecting overall status', async () => {
    cacheService.isConnected.mockResolvedValue(false);

    const result = await controller.check();

    expect(result.status).toBe('ok');
    expect(result.redis).toBe('down');
  });

  it('should not expose sensitive configuration', async () => {
    const result = await controller.check();
    const serialized = JSON.stringify(result);

    expect(serialized).not.toMatch(/password/i);
    expect(serialized).not.toMatch(/secret/i);
  });
});
