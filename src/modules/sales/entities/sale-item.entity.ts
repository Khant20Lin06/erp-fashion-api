import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Sale } from './sale.entity';
import { ProductVariant } from '../../products/entities/product-variant.entity';
import { Uom } from '../../uom/entities/uom.entity';

/**
 * Sale line item. Snapshot-only — never live-references mutable
 * Product/ProductVariant/PriceListItem fields after creation (the same
 * "snapshot, don't live-reference" principle
 * docs/PRODUCT_VARIANT_PRICING_ARCHITECTURE.md established for
 * Product/Price, and docs/CUSTOMER_SUPPLIER_ARCHITECTURE.md §18 requires
 * Phase 12 to apply to Customer values too — see Sale's own
 * customer-snapshot fields... actually Sale intentionally does NOT
 * snapshot Customer fields onto itself; see docs/SALES_ARCHITECTURE.md
 * "Customer Integration" for why customerId alone is sufficient here and
 * a full customer snapshot was not added).
 *
 * productVariantId is RESTRICT (never let a ProductVariant deletion
 * silently orphan or cascade-delete historical sale data); saleId is
 * CASCADE (a SaleItem is meaningless without its parent Sale — deleting a
 * Sale, which this phase never actually does via the API since delete is
 * out of scope, would correctly cascade).
 *
 * No independent soft-delete on this table (Phase 12 locked decision) —
 * SaleItems are never independently deleted; they only ever cease to exist
 * alongside a hard-deleted parent Sale, which no code path in this phase
 * performs.
 */
@Entity('sale_items')
export class SaleItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'sale_id', type: 'char', length: 36 })
  saleId!: string;

  @ManyToOne(() => Sale, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_id' })
  sale!: Sale;

  @Index()
  @Column({ name: 'product_variant_id', type: 'char', length: 36 })
  productVariantId!: string;

  @ManyToOne(() => ProductVariant, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_variant_id' })
  productVariant!: ProductVariant;

  @Index()
  @Column({ name: 'uom_id', type: 'char', length: 36, nullable: true })
  uomId!: string | null;

  @ManyToOne(() => Uom, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'uom_id' })
  uom?: Uom | null;

  @Column({ name: 'uom_code_snapshot', type: 'varchar', length: 20, nullable: true })
  uomCodeSnapshot!: string | null;

  @Column({ name: 'uom_name_snapshot', type: 'varchar', length: 100, nullable: true })
  uomNameSnapshot!: string | null;

  @Column({ name: 'quantity', type: 'int' })
  quantity!: number;

  @Column({ name: 'base_quantity_snapshot', type: 'int', default: 0 })
  baseQuantitySnapshot!: number;

  @Column({
    name: 'unit_price_snapshot',
    type: 'decimal',
    precision: 14,
    scale: 2,
  })
  unitPriceSnapshot!: string;

  @Column({
    name: 'conversion_factor_to_base_snapshot',
    type: 'decimal',
    precision: 14,
    scale: 4,
    default: 1,
  })
  conversionFactorToBaseSnapshot!: string;

  @Column({
    name: 'discount_snapshot',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  discountSnapshot!: string;

  /**
   * Server-validated pass-through value — NOT computed by any tax rate
   * engine (none exists in this codebase). See
   * docs/SALES_ARCHITECTURE.md "Tax Boundary" for the full, honest
   * statement of this limitation.
   */
  @Column({
    name: 'tax_snapshot',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  taxSnapshot!: string;

  @Column({ name: 'line_total', type: 'decimal', precision: 14, scale: 2 })
  lineTotal!: string;

  @Column({ name: 'product_name_snapshot', type: 'varchar', length: 200 })
  productNameSnapshot!: string;

  @Column({ name: 'sku_snapshot', type: 'varchar', length: 100 })
  skuSnapshot!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}
