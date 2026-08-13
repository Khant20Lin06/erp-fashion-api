import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';
import { Branch } from '../../organization/entities/branch.entity';
import { CustomerGroup } from './customer-group.entity';
import { PaymentTerm } from './payment-term.entity';
import { CustomerStatus } from './customer-status.enum';

/**
 * Customer as an independently modeled entity (Phase 11 locked decision
 * §1 — NOT a generic Party/BusinessParty). Company-scoped as the primary
 * tenancy key (companyId required, immutable in practice — never mutated by
 * any service method in this phase); branchId is OPTIONAL, mirroring the
 * fact that Phase 11.md's own Customer field list (§5) only lists "company",
 * never "branch", while §16 leaves company-vs-branch scope ambiguous and
 * defers to "existing architecture" — since Employee (Phase 08) requires
 * branchId while Company itself does not, and since the user's explicit
 * lock states "Customer/Supplier are company-scoped" as the primary key, a
 * nullable branchId (validated server-side against companyId when present,
 * exactly like Warehouse/Employee) was chosen as the conservative middle
 * ground: it satisfies §16's "company + branch" option for callers who want
 * it without forcing every customer to declare one. Documented as an
 * explicit resolved ambiguity in docs/CUSTOMER_SUPPLIER_ARCHITECTURE.md.
 *
 * creditLimit/creditDays are Customer-only credit CONTROL fields, entirely
 * separate in meaning from paymentTermId (Phase 11 §6/§11, LOCKED — see
 * payment-term.entity.ts's docblock). openingBalanceAmount is stored
 * verbatim as initial master data only — never treated as, or recalculated
 * into, a live/current balance anywhere in this phase (Phase 11 locked
 * decision §8). receivableAccountId is a nullable, FK-less UUID placeholder
 * for Phase 17 (locked decision §9) — intentionally has no @ManyToOne/FK
 * constraint since no GL Account table exists yet.
 */
@Entity('customers')
@Index(['companyId', 'customerCode'], { unique: true })
export class Customer extends BaseEntity {
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

  @Column({ name: 'customer_code', type: 'varchar', length: 50 })
  customerCode!: string;

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
    name: 'customer_group_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  customerGroupId!: string | null;

  @ManyToOne(() => CustomerGroup, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'customer_group_id' })
  customerGroup?: CustomerGroup | null;

  @Column({ name: 'payment_term_id', type: 'char', length: 36, nullable: true })
  paymentTermId!: string | null;

  @ManyToOne(() => PaymentTerm, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'payment_term_id' })
  paymentTerm?: PaymentTerm | null;

  /** Maximum outstanding credit allowed. NOT the same as paymentTermId's "when due" meaning. */
  @Column({
    name: 'credit_limit',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  creditLimit!: string;

  @Column({ name: 'credit_days', type: 'int', default: 0 })
  creditDays!: number;

  /**
   * Initial master-data balance ONLY. Never a live/current balance, never
   * recalculated, never updated by any flow other than an explicit edit of
   * this master-data field. See docs/CUSTOMER_SUPPLIER_ARCHITECTURE.md
   * "Opening Balance Semantics" for the full statement. Phase 17 owns the
   * real ledger.
   */
  @Column({
    name: 'opening_balance_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  openingBalanceAmount!: string;

  /**
   * Inert placeholder for Phase 17's Chart of Accounts. Deliberately has
   * NO foreign key constraint — no GL Account table exists yet, and
   * inventing one "just for Phase 11" is explicitly forbidden.
   */
  @Column({
    name: 'receivable_account_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  receivableAccountId!: string | null;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: CustomerStatus,
    default: CustomerStatus.Active,
  })
  status!: CustomerStatus;

  @Column({ name: 'notes', type: 'varchar', length: 1000, nullable: true })
  notes!: string | null;
}
