import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { CompanyStatus } from './company-status.enum';
import { Branch } from './branch.entity';

/**
 * Root organizational entity (Phase 07 §3, §64) — Branch and Warehouse both
 * chain up to Company; there is no persisted Organization entity above it.
 * `legalName` is intentionally omitted: the spec lists it as optional and no
 * concrete requirement for a legal-name/trade-name distinction exists yet —
 * add it later if the business surfaces one, rather than speculatively now.
 */
@Entity('companies')
export class Company extends BaseEntity {
  @Column({ name: 'code', type: 'varchar', length: 50, unique: true })
  code!: string;

  @Column({ name: 'name', type: 'varchar', length: 200 })
  name!: string;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: CompanyStatus,
    default: CompanyStatus.Active,
  })
  status!: CompanyStatus;

  @Column({ name: 'base_currency', type: 'varchar', length: 3 })
  baseCurrency!: string;

  @Column({ name: 'timezone', type: 'varchar', length: 100 })
  timezone!: string;

  @Column({ name: 'country', type: 'varchar', length: 100, nullable: true })
  country!: string | null;

  @Column({ name: 'phone', type: 'varchar', length: 50, nullable: true })
  phone!: string | null;

  @Column({ name: 'email', type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ name: 'address', type: 'varchar', length: 500, nullable: true })
  address!: string | null;

  @OneToMany(() => Branch, (branch) => branch.company)
  branches?: Branch[];
}
