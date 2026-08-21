import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsRegistryService } from './metrics/metrics-registry.service';
import { MetricsInterceptor } from './metrics/metrics.interceptor';
import { MetricsService } from './metrics/metrics.controller';

@Global()
@Module({
  providers: [
    MetricsRegistryService,
    MetricsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
  exports: [MetricsRegistryService, MetricsService],
})
export class ObservabilityModule {}
