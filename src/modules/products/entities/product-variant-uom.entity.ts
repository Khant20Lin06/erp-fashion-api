import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';
import { ProductVariant } from './product-variant.entity';
import { Uom } from '../../uom/entities/uom.entity';
import { ProductVariantUomUsageType } from './product-variant-uom-usage-type.enum';

@Entity('product_variant_uoms')
@Index(['variantId', 'uomId'], { unique: true })
export class ProductVariantUom extends BaseEntity {
  @Column({ name: 'variant_id', type: 'char', length: 36 })
  variantId!: string;

  @ManyToOne(() => ProductVariant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'variant_id' })
  variant!: ProductVariant;

  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Column({ name: 'uom_id', type: 'char', length: 36 })
  uomId!: string;

  @ManyToOne(() => Uom, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'uom_id' })
  uom!: Uom;

  @Column({
    name: 'conversion_factor_to_base',
    type: 'decimal',
    precision: 14,
    scale: 4,
  })
  conversionFactorToBase!: string;

  @Column({
    name: 'usage_type',
    type: 'enum',
    enum: ProductVariantUomUsageType,
    default: ProductVariantUomUsageType.Both,
  })
  usageType!: ProductVariantUomUsageType;

  @Column({ name: 'barcode', type: 'varchar', length: 100, nullable: true })
  barcode!: string | null;

  @Index()
  @Column({ name: 'is_base', type: 'boolean', default: false })
  isBase!: boolean;

  @Index()
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}
