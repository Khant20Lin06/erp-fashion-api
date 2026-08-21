import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { AppConfig } from '../config/app.config';
import { CacheService } from '../modules/redis/cache.service';
import { KafkaProducerService } from '../modules/kafka/kafka-producer.service';
import { QueueService } from '../modules/queue/queue.service';
import { AppRole, getAppRole } from '../shared/utils/runtime-flags';

export interface DependencyStatus {
  status: 'up' | 'down';
  required: boolean;
}

export interface ReadinessResponse {
  status: 'ready' | 'not_ready';
  service: string;
  environment: string;
  role: AppRole;
  timestamp: string;
  checks: {
    mysql: DependencyStatus;
    redis: DependencyStatus;
    kafka: DependencyStatus;
    bullmq: DependencyStatus;
  };
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly cacheService: CacheService,
    private readonly kafkaProducerService: KafkaProducerService,
    private readonly queueService: QueueService,
  ) {}

  async getOverview(): Promise<{
    status: 'ok';
    service: string;
    environment: string;
    role: AppRole;
    timestamp: string;
    ready: boolean;
    mysql: 'up' | 'down';
    redis: 'up' | 'down';
    kafka: 'up' | 'down';
    bullmq: 'up' | 'down';
  }> {
    const readiness = await this.evaluateReadiness();
    return {
      status: 'ok',
      service: this.appConfig.appName,
      environment: this.appConfig.nodeEnv,
      role: getAppRole(),
      timestamp: new Date().toISOString(),
      ready: readiness.status === 'ready',
      mysql: readiness.checks.mysql.status,
      redis: readiness.checks.redis.status,
      kafka: readiness.checks.kafka.status,
      bullmq: readiness.checks.bullmq.status,
    };
  }

  getLiveness(): {
    status: 'ok';
    service: string;
    environment: string;
    role: AppRole;
    timestamp: string;
  } {
    return {
      status: 'ok',
      service: this.appConfig.appName,
      environment: this.appConfig.nodeEnv,
      role: getAppRole(),
      timestamp: new Date().toISOString(),
    };
  }

  async getReadinessOrThrow(): Promise<ReadinessResponse> {
    const readiness = await this.evaluateReadiness();
    if (readiness.status === 'not_ready') {
      throw new ServiceUnavailableException(readiness);
    }
    return readiness;
  }

  private get appConfig(): AppConfig {
    return this.configService.get<AppConfig>('app')!;
  }

  private async evaluateReadiness(): Promise<ReadinessResponse> {
    const role = getAppRole();
    const required = this.requiredDependencies(role);

    const [mysql, redis, kafka, bullmq] = await Promise.all([
      this.checkWithTimeout(() => this.checkMysql()),
      this.checkWithTimeout(() => this.cacheService.isConnected()),
      this.checkWithTimeout(() => this.kafkaProducerService.isConnected()),
      this.checkWithTimeout(() => this.queueService.isConnected()),
    ]);

    const checks = {
      mysql: { status: mysql ? 'up' : 'down', required: required.mysql },
      redis: { status: redis ? 'up' : 'down', required: required.redis },
      kafka: { status: kafka ? 'up' : 'down', required: required.kafka },
      bullmq: { status: bullmq ? 'up' : 'down', required: required.bullmq },
    } as const;

    const ready = Object.values(checks).every(
      (check) => !check.required || check.status === 'up',
    );

    if (!ready) {
      this.logger.warn(
        `Readiness check failed for role=${role}: ${JSON.stringify(checks)}`,
      );
    }

    return {
      status: ready ? 'ready' : 'not_ready',
      service: this.appConfig.appName,
      environment: this.appConfig.nodeEnv,
      role,
      timestamp: new Date().toISOString(),
      checks: {
        mysql: checks.mysql,
        redis: checks.redis,
        kafka: checks.kafka,
        bullmq: checks.bullmq,
      },
    };
  }

  private requiredDependencies(role: AppRole): Record<string, boolean> {
    if (role === AppRole.Api) {
      return { mysql: true, redis: false, kafka: false, bullmq: false };
    }

    if (role === AppRole.Worker) {
      return { mysql: true, redis: true, kafka: true, bullmq: true };
    }

    return { mysql: true, redis: true, kafka: true, bullmq: true };
  }

  private async checkMysql(): Promise<boolean> {
    await this.dataSource.query('SELECT 1');
    return true;
  }

  private async checkWithTimeout(
    operation: () => Promise<boolean>,
  ): Promise<boolean> {
    const timeoutMs = this.appConfig.readinessTimeoutMs;

    return Promise.race([
      operation().catch(() => false),
      new Promise<boolean>((resolve) => {
        setTimeout(() => resolve(false), timeoutMs);
      }),
    ]);
  }
}
