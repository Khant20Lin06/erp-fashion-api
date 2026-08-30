import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';
import { Product } from './product.entity';
import { ProductVariantStatus } from './product-variant-status.enum';
import { Uom } from '../../uom/entities/uom.entity';

/**
 * The stockable/sellable unit (Phase 10 analysis §6, approved — "the
 * Variant represents the actual stockable/sellable SKU"). Every Product,
 * SIMPLE or VARIANT, owns at least one ProductVariant row — created
 * transactionally alongside the Product (analysis D8) — so Phase 12/13/14
 * always have exactly one identity to reference, never a fork between
 * "Product is sellable" and "Variant is sellable."
 *
 * `sku` lives here, never on Product (Phase 10 spec §11, LOCKED).
 * `combinationKey` is a server-computed, deterministic, sorted join of the
 * variant's attribute-option IDs — the relational uniqueness token that
 * prevents duplicate Black/M-style variants under the same Product (Phase
 * 10 analysis §10) without resorting to a JSON blob.
 */
@Entity('product_variants')
@Index(['companyId', 'sku'], { unique: true })
@Index(['productId', 'combinationKey'], { unique: true })
export class ProductVariant extends BaseEntity {
  @Column({ name: 'product_id', type: 'char', length: 36 })
  productId!: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Column({ name: 'sku', type: 'varchar', length: 100 })
  sku!: string;

  /**
   * Deterministic, sorted concatenation of this variant's AttributeOption
   * IDs (e.g. "" for a SIMPLE product's single default variant, or a
   * sorted-and-joined UUID list for a multi-attribute variant). Computed by
   * the service, never trusted from the client. Capped at 8 attributes
   * (DTO-enforced) x 37 chars (36-char UUID + separator) = 296 chars; 300
   * leaves headroom while keeping the composite unique index with
   * product_id well under MySQL's 3072-byte max key length for utf8mb4.
   */
  @Column({ name: 'combination_key', type: 'varchar', length: 300 })
  combinationKey!: string;

  @Column({ name: 'cost_price', type: 'decimal', precision: 12, scale: 2 })
  costPrice!: string;

  @Column({ name: 'selling_price', type: 'decimal', precision: 12, scale: 2 })
  sellingPrice!: string;

  @Column({ name: 'base_uom_id', type: 'char', length: 36, nullable: true })
  baseUomId!: string | null;

  @ManyToOne(() => Uom, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'base_uom_id' })
  baseUom!: Uom | null;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: ProductVariantStatus,
    default: ProductVariantStatus.Active,
  })
  status!: ProductVariantStatus;
}
