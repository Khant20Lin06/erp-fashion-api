import { ConfigService } from '@nestjs/config';
import { MetricsRegistryService } from './metrics-registry.service';
import { AppConfig } from '../../config/app.config';
import { AppRole } from '../../shared/utils/runtime-flags';
import { NodeEnv } from '../../config/env.validation';

describe('MetricsRegistryService', () => {
  let service: MetricsRegistryService;

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
    readinessTimeoutMs: 3000,
    httpRequestTimeoutMs: 30000,
    httpKeepAliveTimeoutMs: 5000,
    httpHeadersTimeoutMs: 60000,
    trustProxy: false,
    rateLimitEnabled: true,
    rateLimitMaxRequests: 300,
    rateLimitWindowSeconds: 60,
  };

  beforeEach(() => {
    delete process.env.APP_ROLE;
    service = new MetricsRegistryService({
      get: jest.fn().mockReturnValue(appConfig),
    } as unknown as ConfigService);
  });

  it('renders app metadata and recorded HTTP metrics', () => {
    service.incrementActiveHttpRequests();
    service.recordHttpRequest('GET', '/api/v1/health', 200, 12);

    const output = service.render();

    expect(output).toContain('fashion_erp_app_info');
    expect(output).toContain('service="Fashion ERP Backend"');
    expect(output).toContain('fashion_erp_active_http_requests 1');
    expect(output).toContain('fashion_erp_http_requests_total');
    expect(output).toContain('route="/api/v1/health"');
  });

  it('sanitizes routes and records Redis/BullMQ/Kafka metrics', () => {
    service.recordRedisOperation('get', 'hit', 3);
    service.recordKafkaPublish('erp.payment.events', 'success', 8);
    service.recordKafkaConsume('erp.payment.events', 'error', 9);
    service.recordBullMqEnqueue('notifications', 'success');
    service.recordBullMqJob(
      'notifications',
      'send-notification',
      'failure',
      25,
    );

    const output = service.render();

    expect(output).toContain('fashion_erp_redis_operations_total');
    expect(output).toContain('fashion_erp_kafka_publish_total');
    expect(output).toContain('fashion_erp_kafka_consume_total');
    expect(output).toContain('fashion_erp_bullmq_enqueue_total');
    expect(output).toContain('fashion_erp_bullmq_jobs_total');
  });
});
