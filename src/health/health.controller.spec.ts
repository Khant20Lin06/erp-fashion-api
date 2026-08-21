import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: {
    getOverview: jest.Mock;
    getLiveness: jest.Mock;
    getReadinessOrThrow: jest.Mock;
  };

  beforeEach(async () => {
    healthService = {
      getOverview: jest.fn().mockResolvedValue({
        status: 'ok',
        service: 'Fashion ERP Backend',
        environment: 'test',
        role: 'all',
        timestamp: '2026-08-15T09:00:00.000Z',
        ready: true,
        mysql: 'up',
        redis: 'up',
        kafka: 'up',
        bullmq: 'up',
      }),
      getLiveness: jest.fn().mockReturnValue({
        status: 'ok',
        service: 'Fashion ERP Backend',
        environment: 'test',
        role: 'all',
        timestamp: '2026-08-15T09:00:00.000Z',
      }),
      getReadinessOrThrow: jest.fn().mockResolvedValue({
        status: 'ready',
        service: 'Fashion ERP Backend',
        environment: 'test',
        role: 'all',
        timestamp: '2026-08-15T09:00:00.000Z',
        checks: {
          mysql: { status: 'up', required: true },
          redis: { status: 'up', required: true },
          kafka: { status: 'up', required: true },
          bullmq: { status: 'up', required: true },
        },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: healthService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates overview requests to HealthService', async () => {
    const result = await controller.check();

    expect(result.status).toBe('ok');
    expect(result.mysql).toBe('up');
    expect(healthService.getOverview).toHaveBeenCalledTimes(1);
  });

  it('delegates liveness requests to HealthService', () => {
    const result = controller.live();

    expect(result.status).toBe('ok');
    expect(healthService.getLiveness).toHaveBeenCalledTimes(1);
  });

  it('delegates readiness requests to HealthService', async () => {
    const result = await controller.ready();

    expect(result.status).toBe('ready');
    expect(healthService.getReadinessOrThrow).toHaveBeenCalledTimes(1);
  });
});
