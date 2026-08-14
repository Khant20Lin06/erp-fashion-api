import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
import { Warehouse } from '../../organization/entities/warehouse.entity';
import { ProductVariant } from '../../products/entities/product-variant.entity';
import { User } from '../../users/entities/user.entity';
import { StockMovementType } from './stock-movement-type.enum';
import { StockMovementReferenceType } from './stock-movement-reference-type.enum';

/**
 * Append-only internal stock movement log (Phase 14 locked decision D4).
 * No update, no delete, no soft-delete, no PATCH/DELETE endpoint, and no
 * public list/query endpoint at all in this phase — Phase 14 writes this
 * table; Phase 15 is the phase that ever queries/reports on it as a real
 * "Inventory Ledger." See docs/INVENTORY_ARCHITECTURE.md's explicit
 * "Phase 14 writes, Phase 15 queries" boundary statement.
 *
 * referenceType/referenceId form a polymorphic pointer into whichever
 * table actually owns the originating transaction (GoodsReceipt/Sale/
 * StockTransfer/StockAdjustment) — referenceId deliberately carries no FK
 * constraint since it points to a different table depending on
 * referenceType (an FK cannot express that). quantityAfter is a
 * denormalized snapshot of the resulting WarehouseStock.onHandQuantity at
 * the moment this movement was written, useful for audit/debugging without
 * needing to replay the whole history.
 */
@Entity('stock_movements')
export class StockMovement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'warehouse_id', type: 'char', length: 36 })
  warehouseId!: string;

  @ManyToOne(() => Warehouse, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse!: Warehouse;

  @Index()
  @Column({ name: 'product_variant_id', type: 'char', length: 36 })
  productVariantId!: string;

  @ManyToOne(() => ProductVariant, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_variant_id' })
  productVariant!: ProductVariant;

  @Index()
  @Column({
    name: 'movement_type',
    type: 'enum',
    enum: StockMovementType,
  })
  movementType!: StockMovementType;

  @Column({ name: 'quantity_change', type: 'int' })
  quantityChange!: number;

  @Column({ name: 'quantity_after', type: 'int' })
  quantityAfter!: number;

  @Index()
  @Column({
    name: 'reference_type',
    type: 'enum',
    enum: StockMovementReferenceType,
  })
  referenceType!: StockMovementReferenceType;

  /** Polymorphic pointer — no FK constraint (points to a different table depending on referenceType). */
  @Index()
  @Column({ name: 'reference_id', type: 'char', length: 36 })
  referenceId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @Column({ name: 'created_by', type: 'char', length: 36, nullable: true })
  createdBy!: string | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser?: User | null;
}
