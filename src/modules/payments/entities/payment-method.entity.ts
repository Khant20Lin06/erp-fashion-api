import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';
import { Account } from '../../accounting/entities/account.entity';
import { PaymentMethodStatus } from './payment-method-status.enum';

/**
 * PaymentMethod (D7, LOCKED): a real, configurable, company-scoped
 * master-data entity — not an enum — mirroring Phase 09's
 * Category/Brand shape exactly (`code`/`name`/`status`, `UNIQUE(company_id,
 * code)`, `status` as an ACTIVE/INACTIVE enum, not a boolean, matching the
 * codebase's established master-data convention rather than inventing a
 * boolean field). No `CashAccount`/`BankAccount`/balance of any kind lives
 * here (D8) — a `Payment.reference` free-text field carries any
 * transfer/cheque reference number instead.
 *
 * `glAccountId` (PHASE 17 ADDITIVE COLUMN, nullable, FK -> accounts):
 * resolves which Account this PaymentMethod posts to on the cash/bank side
 * when AccountingPostingService.postPayment() builds a Payment's journal
 * entry (Phase 17 D6/§6, LOCKED: "The actual Account used on the cash/bank
 * side must be resolved from PaymentMethod configuration"). This is a
 * deliberate, additive-only schema change to a Phase 16 entity — added via
 * Phase 17's own migration (ALTER TABLE ADD COLUMN + ADD CONSTRAINT), never
 * touching any existing column, index, or Phase 16 logic. A real FK
 * (ON DELETE RESTRICT) is used, unlike Customer.receivableAccountId /
 * Supplier.payableAccountId's deliberately FK-less placeholders — those
 * were FK-less because no Chart of Accounts table existed yet when Phase 11
 * created them; `accounts` exists by the time this column is created within
 * this same Phase 17 migration; a live table with no reason to leave the
 * reference undeclared. If null, PaymentsService.create() ->
 * AccountingPostingService.postPayment() fails the entire Payment
 * transaction (per Phase 17 D6's fail-closed account-mapping semantics) —
 * this column existing does not change any Phase 16 read/write path, since
 * nothing in PaymentMethodsService/PaymentMethodsController touches it
 * (CreatePaymentMethodDto does not expose it — set only via direct
 * administration, matching the locked PaymentMethod API surface which has
 * no PATCH endpoint at all).
 */
@Entity('payment_methods')
@Index(['companyId', 'code'], { unique: true })
export class PaymentMethod extends BaseEntity {
  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Column({ name: 'code', type: 'varchar', length: 50 })
  code!: string;

  @Column({ name: 'name', type: 'varchar', length: 200 })
  name!: string;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: PaymentMethodStatus,
    default: PaymentMethodStatus.Active,
  })
  status!: PaymentMethodStatus;

  @Column({
    name: 'gl_account_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  glAccountId!: string | null;

  @ManyToOne(() => Account, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'gl_account_id' })
  glAccount?: Account | null;
}
