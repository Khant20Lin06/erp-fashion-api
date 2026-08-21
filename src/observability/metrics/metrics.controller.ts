import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { MetricsRegistryService } from './metrics-registry.service';
import { OutboxEvent } from '../../modules/outbox/entities/outbox-event.entity';
import { OutboxEventStatus } from '../../modules/outbox/entities/outbox-event-status.enum';
import { QueueService } from '../../modules/queue/queue.service';
import { AppConfig } from '../../config/app.config';

@Injectable()
export class MetricsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly metrics: MetricsRegistryService,
    private readonly dataSource: DataSource,
    private readonly queueService: QueueService,
  ) {}

  async render(): Promise<string> {
    try {
      const extras = await Promise.all([
        this.collectOutboxMetrics(),
        this.collectQueueMetrics(),
      ]);
      return this.metrics.render(extras.flat());
    } catch {
      return this.metrics.render();
    }
  }

  path(): string {
    const appConfig = this.configService.get<AppConfig>('app')!;
    return appConfig.metricsPath.replace(/^\/+/, '');
  }

  private async collectOutboxMetrics(): Promise<
    Array<{
      name: string;
      help: string;
      type: 'gauge';
      values: Map<string, number>;
    }>
  > {
    const repository = this.dataSource.getRepository(OutboxEvent);
    const [pending, failed, published, oldestPending] = await Promise.all([
      repository.count({
        where: [
          { status: OutboxEventStatus.Pending },
          { status: OutboxEventStatus.Failed },
        ],
      }),
      repository.count({ where: { status: OutboxEventStatus.Failed } }),
      repository.count({ where: { status: OutboxEventStatus.Published } }),
      repository
        .createQueryBuilder('event')
        .where('event.status IN (:...statuses)', {
          statuses: [OutboxEventStatus.Pending, OutboxEventStatus.Failed],
        })
        .orderBy('event.availableAt', 'ASC')
        .getOne(),
    ]);

    const now = Date.now();
    const oldestPendingAgeSeconds = oldestPending
      ? Math.max(
          0,
          Math.floor((now - oldestPending.availableAt.getTime()) / 1000),
        )
      : 0;

    return [
      {
        name: 'fashion_erp_outbox_events',
        help: 'Current outbox event counts by state.',
        type: 'gauge',
        values: new Map<string, number>([
          ['status="pending_or_retryable"', pending],
          ['status="failed"', failed],
          ['status="published"', published],
        ]),
      },
      {
        name: 'fashion_erp_outbox_oldest_pending_age_seconds',
        help: 'Age in seconds of the oldest pending or retryable outbox event.',
        type: 'gauge',
        values: new Map<string, number>([['', oldestPendingAgeSeconds]]),
      },
    ];
  }

  private async collectQueueMetrics(): Promise<
    Array<{
      name: string;
      help: string;
      type: 'gauge';
      values: Map<string, number>;
    }>
  > {
    const countsByQueue = await this.queueService.getQueueCounts();
    const values = new Map<string, number>();

    for (const [queueName, counts] of Object.entries(countsByQueue)) {
      for (const [state, count] of Object.entries(counts)) {
        values.set(`queue="${queueName}",state="${state}"`, count);
      }
    }

    return [
      {
        name: 'fashion_erp_bullmq_queue_jobs',
        help: 'Current BullMQ job counts by queue and state.',
        type: 'gauge',
        values,
      },
    ];
  }
}
