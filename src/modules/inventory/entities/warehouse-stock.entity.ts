import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Warehouse } from '../../organization/entities/warehouse.entity';
import { ProductVariant } from '../../products/entities/product-variant.entity';

/**
 * The current stock balance for one (warehouse, productVariant) pair —
 * Phase 14 locked decision D3. Not a lifecycle entity (no soft-delete, no
 * BaseEntity): a WarehouseStock row is a live balance, created lazily via
 * upsert the first time any operation (GoodsReceipt/Sale/Transfer/
 * Adjustment) touches that (warehouse, variant) pair.
 *
 * onHandQuantity is the authoritative real stock count. reservedQuantity
 * exists purely for schema-forward compatibility with a future reservation
 * workflow (D8, LOCKED) — nothing in Phase 14 ever writes a non-zero value
 * to it. availableQuantity (onHandQuantity - reservedQuantity) is
 * deliberately NOT persisted — it is computed only in response DTOs.
 *
 * No cost/value column (D16) — valuation is Phase 17's concern.
 * UNIQUE(warehouse_id, product_variant_id) is the stock-identity contract
 * referenced by docs/PRODUCT_VARIANT_PRICING_ARCHITECTURE.md §21.
 */
@Entity('warehouse_stock')
@Index(['warehouseId', 'productVariantId'], { unique: true })
export class WarehouseStock {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'warehouse_id', type: 'char', length: 36 })
  warehouseId!: string;

  @ManyToOne(() => Warehouse, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse!: Warehouse;

  @Column({ name: 'product_variant_id', type: 'char', length: 36 })
  productVariantId!: string;

  @ManyToOne(() => ProductVariant, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_variant_id' })
  productVariant!: ProductVariant;

  @Column({ name: 'on_hand_quantity', type: 'int', default: 0 })
  onHandQuantity!: number;

  /**
   * Schema-forward-compat only (D8, LOCKED) — always 0 in this phase.
   * No reservation service/API/lifecycle exists anywhere in Phase 14.
   */
  @Column({ name: 'reserved_quantity', type: 'int', default: 0 })
  reservedQuantity!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}
