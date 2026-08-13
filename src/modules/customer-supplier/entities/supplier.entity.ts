import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';
import { Branch } from '../../organization/entities/branch.entity';
import { SupplierGroup } from './supplier-group.entity';
import { PaymentTerm } from './payment-term.entity';
import { SupplierStatus } from './supplier-status.enum';

/**
 * Supplier as an independently modeled entity, mirroring Customer's
 * architecture exactly (Phase 11 locked decision §1) but with its own
 * table, own status enum instance, and Supplier-appropriate credit terms.
 * Per Phase 11.md §6/§21, Supplier does not get a creditLimit field (only
 * Customer receivables are limited by a credit ceiling in this domain
 * model) — Supplier gets creditDays only, i.e. the credit TERM (how many
 * days of payment deferral the supplier extends to us), consistent with
 * "Supplier credit terms should support appropriate payment/credit
 * information" (§11) and the field list at §6 which omits creditLimit for
 * Supplier. payableAccountId mirrors receivableAccountId — see
 * customer.entity.ts's docblock for the full FK-less-placeholder rationale.
 */
@Entity('suppliers')
@Index(['companyId', 'supplierCode'], { unique: true })
export class Supplier extends BaseEntity {
  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Column({ name: 'branch_id', type: 'char', length: 36, nullable: true })
  branchId!: string | null;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'branch_id' })
  branch?: Branch | null;

  @Column({ name: 'supplier_code', type: 'varchar', length: 50 })
  supplierCode!: string;

  @Column({ name: 'name', type: 'varchar', length: 200 })
  name!: string;

  @Column({
    name: 'display_name',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  displayName!: string | null;

  @Index()
  @Column({ name: 'phone', type: 'varchar', length: 50, nullable: true })
  phone!: string | null;

  @Index()
  @Column({ name: 'email', type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({
    name: 'supplier_group_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  supplierGroupId!: string | null;

  @ManyToOne(() => SupplierGroup, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'supplier_group_id' })
  supplierGroup?: SupplierGroup | null;

  @Column({ name: 'payment_term_id', type: 'char', length: 36, nullable: true })
  paymentTermId!: string | null;

  @ManyToOne(() => PaymentTerm, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'payment_term_id' })
  paymentTerm?: PaymentTerm | null;

  /** Credit TERM extended by this supplier to us (days), not a limit we impose on them. */
  @Column({ name: 'credit_days', type: 'int', default: 0 })
  creditDays!: number;

  /** Initial master-data balance ONLY — see Customer.openingBalanceAmount's docblock; identical semantics. */
  @Column({
    name: 'opening_balance_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  openingBalanceAmount!: string;

  /** Inert Phase 17 placeholder, no FK — see Customer.receivableAccountId's docblock. */
  @Column({
    name: 'payable_account_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  payableAccountId!: string | null;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: SupplierStatus,
    default: SupplierStatus.Active,
  })
  status!: SupplierStatus;

  @Column({ name: 'notes', type: 'varchar', length: 1000, nullable: true })
  notes!: string | null;
}
