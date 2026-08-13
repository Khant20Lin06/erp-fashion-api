import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';
import { PaymentTermStatus } from './payment-term-status.enum';

/**
 * One shared, configurable, company-scoped Payment Term table referenced by
 * BOTH Customer and Supplier (Phase 11 §6/§12, LOCKED — "Do not hardcode
 * Cash/Net 30/etc", "one shared ... entity ... referenced by both"). Kept
 * entirely separate in meaning from Credit Limit: PaymentTerm.dueDays is
 * "when payment is due"; Customer.creditLimit/creditDays is "how much
 * credit / how many days of credit exposure are allowed" — two different
 * business concepts that must never collapse into one field (Phase 11 §6,
 * LOCKED). Mirrors the Phase 09 Brand/Collection company-scoped CRUD
 * pattern exactly.
 */
@Entity('payment_terms')
@Index(['companyId', 'code'], { unique: true })
export class PaymentTerm extends BaseEntity {
  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Column({ name: 'code', type: 'varchar', length: 50 })
  code!: string;

  @Column({ name: 'name', type: 'varchar', length: 200 })
  name!: string;

  @Column({ name: 'description', type: 'varchar', length: 500, nullable: true })
  description!: string | null;

  @Column({ name: 'due_days', type: 'int' })
  dueDays!: number;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: PaymentTermStatus,
    default: PaymentTermStatus.Active,
  })
  status!: PaymentTermStatus;
}
