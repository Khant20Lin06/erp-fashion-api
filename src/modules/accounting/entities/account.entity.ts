import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';
import { AccountType } from './account-type.enum';

/**
 * Chart of Accounts (D4, LOCKED). Company-scoped, self-referencing
 * hierarchy — a direct structural mirror of Phase 09's Category entity
 * (parentId -> accounts, ON DELETE RESTRICT, UNIQUE(company_id, code),
 * cycle prevention in AccountsService.assertNoCycle() mirroring
 * CategoriesService's own method exactly). accountType is one of the five
 * standard classifications only (see account-type.enum.ts's docblock for
 * why no CASH/BANK/RECEIVABLE/PAYABLE/COGS subtype exists).
 *
 * isSystemAccount marks an account as protected from deletion regardless of
 * whether any posted journal line references it yet (mirrors the
 * isSystemRole precedent from Phase 06) — reserved for future seed-level
 * protection; nothing in this phase currently sets it to true via any
 * endpoint (create/update DTOs do not expose it), so it defaults false for
 * every account created through the API.
 *
 * No delete endpoint exists on this entity's API surface at all (D22 lists
 * only GET/POST/PATCH) — deactivation (isActive=false) is the only
 * lifecycle transition, consistent with D4's "no delete if referenced by
 * any posted journal line — prefer deactivation" instruction taken to its
 * simplest safe form: never expose delete in the first place.
 */
@Entity('accounts')
@Index(['companyId', 'code'], { unique: true })
export class Account extends BaseEntity {
  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Column({ name: 'parent_id', type: 'char', length: 36, nullable: true })
  parentId!: string | null;

  @ManyToOne(() => Account, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent?: Account | null;

  @Column({ name: 'code', type: 'varchar', length: 50 })
  code!: string;

  @Column({ name: 'name', type: 'varchar', length: 200 })
  name!: string;

  @Index()
  @Column({
    name: 'account_type',
    type: 'enum',
    enum: AccountType,
  })
  accountType!: AccountType;

  @Index()
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'is_system_account', type: 'boolean', default: false })
  isSystemAccount!: boolean;
}
