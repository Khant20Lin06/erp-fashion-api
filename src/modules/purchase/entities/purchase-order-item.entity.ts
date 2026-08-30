import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PurchaseOrder } from './purchase-order.entity';
import { ProductVariant } from '../../products/entities/product-variant.entity';
import { Uom } from '../../uom/entities/uom.entity';

/**
 * PurchaseOrder line item. Snapshot-only — never live-references mutable
 * ProductVariant fields after creation (the same "snapshot, don't
 * live-reference" principle docs/PRODUCT_VARIANT_PRICING_ARCHITECTURE.md
 * §20 requires: ProductVariant.costPrice is a reference/default value
 * only, never the authoritative purchase cost for a specific transaction).
 * unitCostSnapshot is always client-supplied and server-validated (>= 0),
 * NEVER server-resolved from ProductVariant.costPrice — Purchase has no
 * PriceList-equivalent resolution engine; the buyer negotiates and
 * supplies the actual cost for this specific order.
 *
 * productVariantId is RESTRICT (never let a ProductVariant deletion
 * silently orphan or cascade-delete historical purchase data); purchase_order_id
 * is CASCADE (a PurchaseOrderItem is meaningless without its parent
 * PurchaseOrder — deleting a PurchaseOrder, which no API endpoint in this
 * phase does, would correctly cascade).
 *
 * No independent soft-delete on this table (Phase 13 locked decision,
 * mirroring SaleItem) — PurchaseOrderItems are never independently
 * created, updated, or deleted outside of PurchaseOrder creation.
 */
@Entity('purchase_order_items')
export class PurchaseOrderItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'purchase_order_id', type: 'char', length: 36 })
  purchaseOrderId!: string;

  @ManyToOne(() => PurchaseOrder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder!: PurchaseOrder;

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

  /**
   * Client-supplied, server-validated (>= 0) transactional purchase cost —
   * NEVER resolved from ProductVariant.costPrice, which is reference/
   * default data only (docs/PRODUCT_VARIANT_PRICING_ARCHITECTURE.md §20).
   */
  @Column({
    name: 'unit_cost_snapshot',
    type: 'decimal',
    precision: 14,
    scale: 2,
  })
  unitCostSnapshot!: string;

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
   * docs/PURCHASE_ARCHITECTURE.md "Tax Snapshot Strategy" for the full,
   * honest statement of this limitation.
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
