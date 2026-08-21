import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';
import { PromotionDiscountType } from './promotion-discount-type.enum';
import { PromotionStatus } from './promotion-status.enum';

/**
 * Promotion — a persisted, deterministic, order-level discount rule a
 * Sale may reference by code at creation time. Company-scoped, applies to
 * the whole Sale only (SALE scope) — no SALE_ITEM-scoped promotion in this
 * phase, since SaleItem-level manual discount already exists
 * (SaleItem.discountSnapshot) and combining a rules engine with per-line
 * discounting introduces ambiguous stacking questions the phase's own
 * "avoid ambiguous combinations" instruction warns against.
 *
 * No hidden rule of any kind: discountType/discountValue/minimumPurchase/
 * startDate/endDate/usageLimit/usageCount are ALL persisted here and read
 * by SalesService at Sale-creation time — never inlined as an `if` in
 * code.
 *
 * usageCount is a denormalized counter, incremented transactionally
 * (locked row) each time a Sale successfully applies this promotion —
 * mirrors PayrollRun.totalGrossPay's own "denormalized cache, updated
 * inside the same lock" precedent. usageLimit=null means unlimited.
 */
@Entity('promotions')
@Index(['companyId', 'code'], { unique: true })
export class Promotion extends BaseEntity {
  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Column({ name: 'code', type: 'varchar', length: 50 })
  code!: string;

  @Column({ name: 'name', type: 'varchar', length: 150 })
  name!: string;

  @Column({ name: 'description', type: 'varchar', length: 500, nullable: true })
  description!: string | null;

  @Column({
    name: 'discount_type',
    type: 'enum',
    enum: PromotionDiscountType,
  })
  discountType!: PromotionDiscountType;

  /**
   * PERCENTAGE: 0-100, DECIMAL(7,4) (matches PayrollComponent.percentage's
   * own precedent exactly — no other percentage-typed column to copy).
   * FIXED_AMOUNT: DECIMAL(14,2), matches Sale's own money precision. Only
   * one of the two "means" is active per row (discountType decides which),
   * but both are stored via a single discountValue column whose scale
   * (7,4) safely represents both a percentage (0-100.0000) and a currency
   * amount up to 999.9999 — for larger fixed amounts DECIMAL(7,4) would
   * overflow, so FIXED_AMOUNT promotions store into the same column at
   * (14,2) precision effectively (service layer never writes more than 2
   * decimal places for FIXED_AMOUNT). See PromotionsService for the exact
   * validation that keeps this unambiguous per row.
   */
  @Column({
    name: 'discount_value',
    type: 'decimal',
    precision: 14,
    scale: 4,
  })
  discountValue!: string;

  @Column({
    name: 'minimum_purchase',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  minimumPurchase!: string;

  /**
   * Only meaningful for PERCENTAGE — caps the absolute discount amount a
   * percentage promotion can produce on any single Sale. Null means
   * uncapped. Ignored for FIXED_AMOUNT (its own discountValue is already
   * the absolute cap).
   */
  @Column({
    name: 'maximum_discount_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  maximumDiscountAmount!: string | null;

  @Column({ name: 'start_date', type: 'date' })
  startDate!: string;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate!: string | null;

  @Column({ name: 'usage_limit', type: 'int', nullable: true })
  usageLimit!: number | null;

  @Column({ name: 'usage_count', type: 'int', default: 0 })
  usageCount!: number;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: PromotionStatus,
    default: PromotionStatus.Active,
  })
  status!: PromotionStatus;

  @Column({ name: 'created_by', type: 'char', length: 36, nullable: true })
  createdBy!: string | null;

  @Column({ name: 'updated_by', type: 'char', length: 36, nullable: true })
  updatedBy!: string | null;
}
