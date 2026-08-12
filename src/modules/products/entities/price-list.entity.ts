import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';
import { PriceListStatus } from './price-list-status.enum';

/**
 * Company-scoped price catalog (Phase 10 §Pricing, LOCKED — PriceList is
 * included in Phase 10, minimal fields only). `currency` is a plain
 * ISO-4217 string, validated at the DTO layer — no Currency entity is
 * created (Phase 09/§Currency Decision, LOCKED); mirrors
 * Company.baseCurrency's own existing varchar(3) pattern rather than
 * inventing a new currency representation. No exchange-rate/conversion
 * logic exists anywhere in this entity or its service.
 */
@Entity('price_lists')
@Index(['companyId', 'code'], { unique: true })
export class PriceList extends BaseEntity {
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

  @Column({ name: 'currency', type: 'char', length: 3 })
  currency!: string;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: PriceListStatus,
    default: PriceListStatus.Active,
  })
  status!: PriceListStatus;
}
