import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';
import { User } from '../../users/entities/user.entity';

/**
 * WebhookSubscription — a company's registration to receive HTTP POSTs for
 * one or more event types. Company-scoped as the primary tenancy key,
 * matching every other master-data entity in this codebase.
 *
 * events is a JSON array of dot-notation event-type strings (e.g.
 * ["payment.confirmed"]) — mirrors OutboxEvent.eventType's own string
 * shape exactly, so a subscription's filter list can be compared directly
 * against an incoming EventEnvelope.eventType with no separate mapping
 * table. A JSON column (not a join table) is used because the set is
 * small, always read as a whole, and never queried by individual event
 * value at the DB level — WebhookDispatchConsumer loads active
 * subscriptions for a company and filters in application code, the same
 * "small in-memory filter over an already-narrow row set" idiom
 * PromotionsService/LoyaltyProgramService use for their own config reads.
 *
 * secret is the raw HMAC signing key. Never returned by any endpoint after
 * creation (see WebhookSubscriptionResponseDto — it has no secret field);
 * never logged (see WebhookDeliveryWorker, which never includes it in any
 * log line). No encryption-at-rest is applied because no such
 * infrastructure exists anywhere in this codebase to reuse (confirmed by
 * audit — no AES/KMS/field-encryption pattern exists for ANY sensitive
 * column, including Payment.idempotencyKey or the refresh-token hash) —
 * introducing one exclusively for this table would be a new, unreviewed
 * security primitive, not a reuse of established architecture. This is a
 * documented, honest limitation, not an oversight.
 *
 * failureCount/lastDeliveredAt are denormalized read-only summaries,
 * updated by WebhookDeliveryWorker after each attempt — justified because
 * without them, checking "is this webhook currently healthy" would require
 * scanning WebhookDelivery history on every subscription list call.
 */
@Entity('webhook_subscriptions')
@Index(['companyId', 'isActive'])
export class WebhookSubscription extends BaseEntity {
  @Index()
  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Column({ name: 'url', type: 'varchar', length: 500 })
  url!: string;

  @Column({ name: 'description', type: 'varchar', length: 500, nullable: true })
  description!: string | null;

  @Column({ name: 'events', type: 'json' })
  events!: string[];

  @Column({ name: 'secret', type: 'varchar', length: 255 })
  secret!: string;

  @Index()
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'failure_count', type: 'int', default: 0 })
  failureCount!: number;

  @Column({ name: 'last_delivered_at', type: 'timestamp', nullable: true })
  lastDeliveredAt!: Date | null;

  @Column({ name: 'created_by', type: 'char', length: 36, nullable: true })
  createdBy!: string | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: User | null;

  @Column({ name: 'updated_by', type: 'char', length: 36, nullable: true })
  updatedBy!: string | null;
}
