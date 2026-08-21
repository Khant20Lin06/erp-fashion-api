import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';

/**
 * LoyaltyProgram — one row per company (singleton, enforced via a unique
 * index), holding only the configurable values the earn/redeem logic
 * actually needs. No hardcoded "1 point per 1000" anywhere in code — every
 * conversion rate comes from this row.
 *
 * pointsPerCurrencyUnit: how many points are earned per 1 unit of
 * Sale.grandTotal currency (e.g. 0.0100 = 1 point per 100 currency units).
 * DECIMAL(10,4) — matches the precision judgment call already made for
 * PayrollComponent.percentage (no existing rate-typed column to copy
 * exactly, so a 4-decimal-place rate column is used here too for the same
 * reason: sub-percent-like precision without floating point).
 *
 * redemptionValuePerPoint: currency value of one point when redeemed
 * (DECIMAL(14,4) — needs to represent very small unit values, e.g.
 * 0.0100 currency per point, precisely). Redemption amount is always
 * computed server-side as `points * redemptionValuePerPoint`, rounded via
 * the same toCents()/centsToDecimalString() integer-cents convention
 * accounting/payroll already use.
 *
 * minimumPurchaseForEarning: a Sale with grandTotal below this amount earns
 * zero points (DECIMAL(14,2), matches Sale's own money precision).
 *
 * isActive: when false, no new EARN transactions are created (existing
 * balances/redeem still work) — mirrors PayrollComponent.isActive's own
 * "stop new use, keep history" semantics.
 */
@Entity('loyalty_programs')
export class LoyaltyProgram extends BaseEntity {
  @Column({ name: 'company_id', type: 'char', length: 36, unique: true })
  companyId!: string;

  @OneToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Column({
    name: 'points_per_currency_unit',
    type: 'decimal',
    precision: 10,
    scale: 4,
  })
  pointsPerCurrencyUnit!: string;

  @Column({
    name: 'redemption_value_per_point',
    type: 'decimal',
    precision: 14,
    scale: 4,
  })
  redemptionValuePerPoint!: string;

  @Column({
    name: 'minimum_purchase_for_earning',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  minimumPurchaseForEarning!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'created_by', type: 'char', length: 36, nullable: true })
  createdBy!: string | null;

  @Column({ name: 'updated_by', type: 'char', length: 36, nullable: true })
  updatedBy!: string | null;
}
