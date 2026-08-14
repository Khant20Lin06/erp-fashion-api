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
import { Company } from '../../organization/entities/company.entity';
import { Branch } from '../../organization/entities/branch.entity';
import { OutboxEventStatus } from './outbox-event-status.enum';
import type { EventEnvelope } from '../interfaces/event-envelope.interface';

/**
 * Transactional Outbox row (Phase 18, D2/D3 LOCKED). Written by
 * OutboxService.create() inside the SAME DB transaction as the business
 * mutation it accompanies (e.g. Payment + PaymentAllocation + JournalEntry +
 * this row, all-or-nothing). OutboxPublisher (a separate polling process)
 * reads PENDING/FAILED rows and publishes them to Kafka strictly AFTER the
 * business transaction has committed — Kafka is never written to from
 * inside a business transaction (D3).
 *
 * `id` is this row's own primary key (append-only log identity). `eventId`
 * is the envelope's stable identity (D7) — distinct from `id` — that flows
 * unchanged through Outbox -> Kafka -> consumer and is what
 * processed_events keys on. No `deletedAt` — this is an append-only log,
 * matching StockMovement/JournalEntryLine precedent (no soft-delete
 * anywhere on an immutable audit-style table in this codebase).
 *
 * aggregateId is a polymorphic pointer (no FK) — mirrors the
 * StockMovement.referenceId / PaymentAllocation.referenceId /
 * JournalEntryLine.referenceId pattern already established: this table logs
 * events for many different aggregate types (only "Payment" today), so a
 * single FK target is not expressible.
 */
@Entity('outbox_events')
@Index(['status', 'availableAt'])
@Index(['companyId', 'occurredAt'])
export class OutboxEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'event_id', type: 'char', length: 36 })
  eventId!: string;

  @Column({ name: 'event_type', type: 'varchar', length: 150 })
  eventType!: string;

  @Column({ name: 'event_version', type: 'int', default: 1 })
  eventVersion!: number;

  @Column({ name: 'aggregate_type', type: 'varchar', length: 100 })
  aggregateType!: string;

  /** Polymorphic pointer — no FK constraint (points to a different table depending on aggregateType). */
  @Column({ name: 'aggregate_id', type: 'char', length: 36 })
  aggregateId!: string;

  @Index()
  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company?: Company;

  @Column({ name: 'branch_id', type: 'char', length: 36, nullable: true })
  branchId!: string | null;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'branch_id' })
  branch?: Branch | null;

  @Column({ name: 'source', type: 'varchar', length: 100 })
  source!: string;

  @Column({
    name: 'correlation_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  correlationId!: string | null;

  @Column({
    name: 'causation_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  causationId!: string | null;

  @Column({ name: 'occurred_at', type: 'timestamp' })
  occurredAt!: Date;

  /**
   * The full event payload (domain-specific body only — NOT the whole
   * envelope; envelope metadata fields are this row's own columns). MySQL
   * JSON column — the first JSON column in this schema (Phase 18 is the
   * first phase with a genuine need for a variable, event-specific shape
   * instead of a fixed set of typed columns).
   */
  @Column({ name: 'payload', type: 'json' })
  payload!: Record<string, unknown>;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: OutboxEventStatus,
    default: OutboxEventStatus.Pending,
  })
  status!: OutboxEventStatus;

  @Column({ name: 'attempt_count', type: 'int', default: 0 })
  attemptCount!: number;

  @Column({ name: 'available_at', type: 'timestamp' })
  availableAt!: Date;

  @Column({ name: 'published_at', type: 'timestamp', nullable: true })
  publishedAt!: Date | null;

  @Column({ name: 'last_error', type: 'varchar', length: 1000, nullable: true })
  lastError!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;

  /**
   * Reconstructs the full wire envelope from this row's columns + payload —
   * the single place envelope shape is assembled for publishing, so
   * OutboxPublisher never hand-rolls the shape itself.
   */
  toEnvelope(): EventEnvelope {
    return {
      eventId: this.eventId,
      eventType: this.eventType,
      eventVersion: this.eventVersion,
      occurredAt: this.occurredAt.toISOString(),
      aggregateType: this.aggregateType,
      aggregateId: this.aggregateId,
      companyId: this.companyId,
      branchId: this.branchId,
      source: this.source,
      correlationId: this.correlationId,
      causationId: this.causationId,
      payload: this.payload,
    };
  }
}
