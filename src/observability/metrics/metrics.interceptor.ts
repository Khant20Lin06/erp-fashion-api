import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { Request, Response } from 'express';
import { MetricsRegistryService } from './metrics-registry.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsRegistryService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const startedAt = Date.now();

    this.metrics.incrementActiveHttpRequests();

    return next.handle().pipe(
      finalize(() => {
        const route = `${request.baseUrl ?? ''}${request.path ?? request.url ?? 'unknown'}`;
        this.metrics.recordHttpRequest(
          request.method,
          route,
          response.statusCode,
          Date.now() - startedAt,
        );
        this.metrics.decrementActiveHttpRequests();
      }),
    );
  }
}
