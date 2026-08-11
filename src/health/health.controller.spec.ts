import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthController } from './health.controller';
import { AppConfig } from '../config/app.config';

describe('HealthController', () => {
  let controller: HealthController;

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
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(mockAppConfig),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return ok status with service and environment', () => {
    const result = controller.check();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('fashion-erp-backend');
    expect(result.environment).toBe('test');
    expect(result.timestamp).toBeDefined();
  });

  it('should not expose sensitive configuration', () => {
    const result = controller.check();
    const serialized = JSON.stringify(result);

    expect(serialized).not.toMatch(/password/i);
    expect(serialized).not.toMatch(/secret/i);
  });
});
