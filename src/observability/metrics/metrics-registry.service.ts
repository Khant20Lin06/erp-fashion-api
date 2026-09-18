import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/app.config';
import { getAppRole } from '../../shared/utils/runtime-flags';

type LabelValue = string | number;
type Labels = Record<string, LabelValue>;

interface CounterMetric {
  type: 'counter';
  help: string;
  values: Map<string, number>;
}

interface GaugeMetric {
  type: 'gauge';
  help: string;
  values: Map<string, number>;
}

interface HistogramMetric {
  type: 'histogram';
  help: string;
  buckets: number[];
  bucketValues: Map<string, number[]>;
  sumValues: Map<string, number>;
  countValues: Map<string, number>;
}

type Metric = CounterMetric | GaugeMetric | HistogramMetric;

const HTTP_DURATION_BUCKETS_MS = [50, 100, 250, 500, 1000, 2500, 5000];
const IO_DURATION_BUCKETS_MS = [5, 10, 25, 50, 100, 250, 500, 1000, 5000];

@Injectable()
export class MetricsRegistryService {
  private readonly metrics = new Map<string, Metric>();
  private readonly appConfig: AppConfig;

  constructor(configService: ConfigService) {
    this.appConfig = configService.get<AppConfig>('app')!;

    this.createGauge(
      'fashion_erp_active_http_requests',
      'Current number of in-flight HTTP requests.',
    );
    this.createCounter(
      'fashion_erp_http_requests_total',
      'Total number of completed HTTP requests.',
    );
    this.createHistogram(
      'fashion_erp_http_request_duration_ms',
      'HTTP request duration in milliseconds.',
      HTTP_DURATION_BUCKETS_MS,
    );
    this.createCounter(
      'fashion_erp_redis_operations_total',
      'Total Redis cache operations by operation and outcome.',
    );
    this.createHistogram(
      'fashion_erp_redis_operation_duration_ms',
      'Redis operation duration in milliseconds.',
      IO_DURATION_BUCKETS_MS,
    );
    this.createCounter(
      'fashion_erp_kafka_publish_total',
      'Total Kafka publish attempts by outcome.',
    );
    this.createHistogram(
      'fashion_erp_kafka_publish_duration_ms',
      'Kafka publish duration in milliseconds.',
      IO_DURATION_BUCKETS_MS,
    );
    this.createCounter(
      'fashion_erp_kafka_consume_total',
      'Total Kafka consume attempts by topic and outcome.',
    );
    this.createHistogram(
      'fashion_erp_kafka_consume_duration_ms',
      'Kafka consume duration in milliseconds.',
      IO_DURATION_BUCKETS_MS,
    );
    this.createCounter(
      'fashion_erp_bullmq_enqueue_total',
      'Total BullMQ enqueue attempts by queue and outcome.',
    );
    this.createCounter(
      'fashion_erp_bullmq_jobs_total',
      'Total BullMQ job outcomes by queue and job name.',
    );
    this.createHistogram(
      'fashion_erp_bullmq_job_duration_ms',
      'BullMQ job processing duration in milliseconds.',
      IO_DURATION_BUCKETS_MS,
    );
    this.createCounter(
      'fashion_erp_ai_tool_executions_total',
      'Total AI agent tool executions by tool, outcome, and type.',
    );
    this.createHistogram(
      'fashion_erp_ai_tool_duration_ms',
      'AI agent tool execution duration in milliseconds.',
      IO_DURATION_BUCKETS_MS,
    );
    this.createCounter(
      'fashion_erp_ai_guardrail_blocks_total',
      'Total AI guardrail violations blocked by rule type.',
    );
    this.createCounter(
      'fashion_erp_ai_approvals_total',
      'Total AI human-in-the-loop approvals by tool and action.',
    );
  }

  recordAiToolExecution(
    toolName: string,
    toolType: string,
    status: string,
    durationMs: number,
  ): void {
    const labels = {
      tool_name: this.sanitizeLabel(toolName),
      tool_type: this.sanitizeLabel(toolType),
      status: this.sanitizeLabel(status),
    };
    this.incrementCounter('fashion_erp_ai_tool_executions_total', labels);
    this.observeHistogram(
      'fashion_erp_ai_tool_duration_ms',
      { tool_name: labels.tool_name },
      durationMs,
    );
  }

  recordAiGuardrailBlock(ruleType: string): void {
    this.incrementCounter('fashion_erp_ai_guardrail_blocks_total', {
      rule_type: this.sanitizeLabel(ruleType),
    });
  }

  recordAiApproval(
    toolName: string,
    action: 'requested' | 'approved' | 'rejected',
  ): void {
    this.incrementCounter('fashion_erp_ai_approvals_total', {
      tool_name: this.sanitizeLabel(toolName),
      action,
    });
  }

  incrementActiveHttpRequests(): void {
    this.addGauge('fashion_erp_active_http_requests', 1);
  }

  decrementActiveHttpRequests(): void {
    this.addGauge('fashion_erp_active_http_requests', -1);
  }

  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationMs: number,
  ): void {
    const labels = {
      method: this.sanitizeLabel(method),
      route: this.sanitizeRoute(route),
      status_code: String(statusCode),
    };
    this.incrementCounter('fashion_erp_http_requests_total', labels);
    this.observeHistogram(
      'fashion_erp_http_request_duration_ms',
      labels,
      durationMs,
    );
  }

  recordRedisOperation(
    operation: string,
    outcome: 'hit' | 'miss' | 'success' | 'error',
    durationMs: number,
  ): void {
    const labels = {
      operation: this.sanitizeLabel(operation),
      outcome,
    };
    this.incrementCounter('fashion_erp_redis_operations_total', labels);
    this.observeHistogram(
      'fashion_erp_redis_operation_duration_ms',
      labels,
      durationMs,
    );
  }

  recordKafkaPublish(
    topic: string,
    outcome: 'success' | 'error',
    durationMs: number,
  ): void {
    const labels = { topic: this.sanitizeTopic(topic), outcome };
    this.incrementCounter('fashion_erp_kafka_publish_total', labels);
    this.observeHistogram(
      'fashion_erp_kafka_publish_duration_ms',
      labels,
      durationMs,
    );
  }

  recordKafkaConsume(
    topic: string,
    outcome: 'success' | 'error',
    durationMs: number,
  ): void {
    const labels = { topic: this.sanitizeTopic(topic), outcome };
    this.incrementCounter('fashion_erp_kafka_consume_total', labels);
    this.observeHistogram(
      'fashion_erp_kafka_consume_duration_ms',
      labels,
      durationMs,
    );
  }

  recordBullMqEnqueue(queue: string, outcome: 'success' | 'error'): void {
    this.incrementCounter('fashion_erp_bullmq_enqueue_total', {
      queue: this.sanitizeLabel(queue),
      outcome,
    });
  }

  recordBullMqJob(
    queue: string,
    jobName: string,
    outcome: 'success' | 'failure',
    durationMs: number,
  ): void {
    const labels = {
      queue: this.sanitizeLabel(queue),
      job_name: this.sanitizeLabel(jobName),
      outcome,
    };
    this.incrementCounter('fashion_erp_bullmq_jobs_total', labels);
    this.observeHistogram(
      'fashion_erp_bullmq_job_duration_ms',
      labels,
      durationMs,
    );
  }

  render(
    extras: Array<{
      name: string;
      help: string;
      type: 'gauge';
      values: Map<string, number>;
    }> = [],
  ): string {
    const lines: string[] = [];
    const infoLabels = this.serializeLabels({
      service: this.appConfig.appName,
      environment: this.appConfig.nodeEnv,
      role: getAppRole(),
    });
    lines.push(
      '# HELP fashion_erp_app_info Static metadata about the running service.',
    );
    lines.push('# TYPE fashion_erp_app_info gauge');
    lines.push(`fashion_erp_app_info{${infoLabels}} 1`);

    for (const [name, metric] of this.metrics) {
      lines.push(`# HELP ${name} ${metric.help}`);
      lines.push(`# TYPE ${name} ${metric.type}`);

      if (metric.type === 'counter' || metric.type === 'gauge') {
        for (const [serializedLabels, value] of metric.values) {
          lines.push(this.formatMetricLine(name, serializedLabels, value));
        }
        continue;
      }

      for (const [serializedLabels, buckets] of metric.bucketValues) {
        const baseLabels = this.deserializeLabels(serializedLabels);
        metric.buckets.forEach((bucket, index) => {
          lines.push(
            this.formatMetricLine(
              `${name}_bucket`,
              this.serializeLabels({ ...baseLabels, le: bucket }),
              buckets[index] ?? 0,
            ),
          );
        });
        lines.push(
          this.formatMetricLine(
            `${name}_bucket`,
            this.serializeLabels({ ...baseLabels, le: '+Inf' }),
            metric.countValues.get(serializedLabels) ?? 0,
          ),
        );
        lines.push(
          this.formatMetricLine(
            `${name}_sum`,
            serializedLabels,
            metric.sumValues.get(serializedLabels) ?? 0,
          ),
        );
        lines.push(
          this.formatMetricLine(
            `${name}_count`,
            serializedLabels,
            metric.countValues.get(serializedLabels) ?? 0,
          ),
        );
      }
    }

    for (const extra of extras) {
      lines.push(`# HELP ${extra.name} ${extra.help}`);
      lines.push(`# TYPE ${extra.name} ${extra.type}`);
      for (const [serializedLabels, value] of extra.values) {
        lines.push(this.formatMetricLine(extra.name, serializedLabels, value));
      }
    }

    return lines.join('\n') + '\n';
  }

  private createCounter(name: string, help: string): void {
    this.metrics.set(name, { type: 'counter', help, values: new Map() });
  }

  private createGauge(name: string, help: string): void {
    this.metrics.set(name, { type: 'gauge', help, values: new Map() });
  }

  private createHistogram(name: string, help: string, buckets: number[]): void {
    this.metrics.set(name, {
      type: 'histogram',
      help,
      buckets,
      bucketValues: new Map(),
      sumValues: new Map(),
      countValues: new Map(),
    });
  }

  private incrementCounter(name: string, labels: Labels = {}): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'counter') {
      return;
    }
    const key = this.serializeLabels(labels);
    metric.values.set(key, (metric.values.get(key) ?? 0) + 1);
  }

  private addGauge(name: string, delta: number, labels: Labels = {}): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'gauge') {
      return;
    }
    const key = this.serializeLabels(labels);
    metric.values.set(key, Math.max(0, (metric.values.get(key) ?? 0) + delta));
  }

  private observeHistogram(
    name: string,
    labels: Labels,
    durationMs: number,
  ): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'histogram') {
      return;
    }

    const key = this.serializeLabels(labels);
    const buckets = metric.bucketValues.get(key) ?? metric.buckets.map(() => 0);
    metric.buckets.forEach((bucket, index) => {
      if (durationMs <= bucket) {
        buckets[index] = (buckets[index] ?? 0) + 1;
      }
    });
    metric.bucketValues.set(key, buckets);
    metric.sumValues.set(key, (metric.sumValues.get(key) ?? 0) + durationMs);
    metric.countValues.set(key, (metric.countValues.get(key) ?? 0) + 1);
  }

  private formatMetricLine(
    name: string,
    serializedLabels: string,
    value: number,
  ): string {
    if (!serializedLabels) {
      return `${name} ${value}`;
    }
    return `${name}{${serializedLabels}} ${value}`;
  }

  private serializeLabels(labels: Labels): string {
    return Object.entries(labels)
      .filter(
        ([, value]) => value !== undefined && value !== null && value !== '',
      )
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}="${String(value).replace(/"/g, '\\"')}"`)
      .join(',');
  }

  private deserializeLabels(serializedLabels: string): Record<string, string> {
    if (!serializedLabels) {
      return {};
    }

    return Object.fromEntries(
      serializedLabels.split(',').map((entry) => {
        const [rawKey, rawValue] = entry.split('=');
        return [rawKey, rawValue.replace(/^"|"$/g, '')];
      }),
    );
  }

  private sanitizeRoute(route: string): string {
    if (!route) {
      return 'unknown';
    }
    return route.replace(/[0-9a-f]{8,}/gi, ':id');
  }

  private sanitizeTopic(topic: string): string {
    return this.sanitizeLabel(topic || 'unknown');
  }

  private sanitizeLabel(value: string): string {
    return value.replace(/[^a-zA-Z0-9:_-]/g, '_');
  }
}
