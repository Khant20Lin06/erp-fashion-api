import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthResponseDto } from './dto/health-response.dto';
import { HealthService, ReadinessResponse } from './health.service';

/**
 * The Kafka connectivity check (Phase 18 addition) is purely informational
 * — `status` at the top level is always 'ok' regardless of Kafka's state.
 * This process's core business operations (Payment/Sale/etc.) never depend
 * on Kafka being reachable (locked spec: "Kafka being down must never fail
 * a business operation"), so this endpoint must never report an overall
 * failure, or be used as a readiness gate, purely because Kafka is
 * unreachable. `kafka: 'down'` is a real, awaited connectivity probe (see
 * KafkaProducerService.isConnected()), not an assumption.
 *
 * The Redis connectivity check (Phase 19 addition) follows the exact same
 * pattern: purely informational, never affects top-level `status`, since
 * Redis is cache-only infrastructure and every cached read already falls
 * back to MySQL transparently on any Redis error (CacheService's own
 * contract). `redis: 'down'` is a real, awaited PING probe (see
 * CacheService.isConnected()), not an assumption.
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: 'Return safe liveness and infrastructure reachability information',
  })
  @ApiOkResponse({
    type: HealthResponseDto,
    description:
      'Safe health payload. Reports Redis and Kafka reachability without exposing credentials or internal connection details.',
  })
  async check(): Promise<HealthResponseDto> {
    return this.healthService.getOverview();
  }

  @Get('live')
  @ApiOperation({
    summary: 'Liveness probe for container/process health',
  })
  @ApiOkResponse({
    description: 'Returns ok when the NestJS process is alive.',
  })
  live(): {
    status: 'ok';
    service: string;
    environment: string;
    role: string;
    timestamp: string;
  } {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Readiness probe for dependency-aware traffic admission',
  })
  @ApiOkResponse({
    description:
      'Returns ready only when the current runtime role has the dependencies it needs to operate safely.',
  })
  ready(): Promise<ReadinessResponse> {
    return this.healthService.getReadinessOrThrow();
  }
}
