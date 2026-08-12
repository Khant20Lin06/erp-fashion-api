import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';
import { ProductVariant } from './product-variant.entity';
import { BarcodeStatus } from './barcode-status.enum';

/**
 * Normalized barcode table (Phase 10 §Barcode, LOCKED) — one variant may
 * hold multiple barcodes; never comma-separated strings or JSON. Kept
 * separate from ProductVariant (and from SKU, a distinct concept) because
 * barcode is company-scoped-unique but not required, and a variant may
 * later carry more than one (e.g. a legacy code plus a current one).
 * `barcode` is a plain string — never assumed numeric (Phase 10 §107).
 */
@Entity('product_variant_barcodes')
@Index(['companyId', 'barcode'], { unique: true })
export class ProductVariantBarcode extends BaseEntity {
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

  @Column({ name: 'barcode', type: 'varchar', length: 100 })
  barcode!: string;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: BarcodeStatus,
    default: BarcodeStatus.Active,
  })
  status!: BarcodeStatus;
}
