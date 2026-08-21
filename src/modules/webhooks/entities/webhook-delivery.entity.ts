import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WebhookSubscription } from './webhook-subscription.entity';
import { WebhookDeliveryStatus } from './webhook-delivery-status.enum';

/**
 * WebhookDelivery — one row per (webhookSubscription, outbox event)
 * delivery attempt record. UNIQUE(webhook_subscription_id, event_id) is
 * the idempotency backstop: WebhookDispatchConsumer creates this row
 * (status PENDING) BEFORE enqueuing the BullMQ job, using eventId as
 * given by OutboxEvent/EventEnvelope — the exact same "stable envelope
 * eventId is the idempotency key" pattern ProcessedEvent/
 * LoyaltyPointTransaction already establish elsewhere in this codebase. A
 * retried Kafka delivery or a BullMQ job retry both resolve to the SAME
 * row (found-and-updated, never a second INSERT) — see
 * WebhookDeliveryWorker for the exact update-in-place logic.
 *
 * No BaseEntity — no soft-delete, no createdBy (system-written only). Rows
 * ARE updated in place (attempt count, status, response) as BullMQ retries
 * occur, rather than one new row per HTTP attempt — a delivery's outcome
 * across retries is one logical fact, and BullMQ's own job history already
 * retains per-attempt detail internally for its configured retention
 * window.
 *
 * Deliberately excludes: secret, Authorization header value, full
 * response body (only a truncated excerpt for debugging — see
 * responseBody's own column comment) — matching the phase's explicit
 * "do not store secrets/full sensitive response bodies" instruction.
 */
@Entity('webhook_deliveries')
@Index(['webhookSubscriptionId', 'eventId'], { unique: true })
@Index(['webhookSubscriptionId', 'createdAt'])
export class WebhookDelivery {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'webhook_subscription_id', type: 'char', length: 36 })
  webhookSubscriptionId!: string;

  @ManyToOne(() => WebhookSubscription, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'webhook_subscription_id' })
  webhookSubscription!: WebhookSubscription;

  /** The OutboxEvent/EventEnvelope's stable eventId — the idempotency key. */
  @Column({ name: 'event_id', type: 'char', length: 36 })
  eventId!: string;

  @Column({ name: 'event_type', type: 'varchar', length: 150 })
  eventType!: string;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: WebhookDeliveryStatus,
    default: WebhookDeliveryStatus.Pending,
  })
  status!: WebhookDeliveryStatus;

  @Column({ name: 'attempt', type: 'int', default: 0 })
  attempt!: number;

  @Column({ name: 'response_status', type: 'int', nullable: true })
  responseStatus!: number | null;

  /** Truncated to 1000 chars at write time — never the full body, never a credential-bearing header. */
  @Column({
    name: 'response_body',
    type: 'varchar',
    length: 1000,
    nullable: true,
  })
  responseBody!: string | null;

  @Column({
    name: 'error_message',
    type: 'varchar',
    length: 1000,
    nullable: true,
  })
  errorMessage!: string | null;

  @Column({ name: 'delivered_at', type: 'timestamp', nullable: true })
  deliveredAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}
