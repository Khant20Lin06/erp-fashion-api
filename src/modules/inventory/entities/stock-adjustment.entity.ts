import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Warehouse } from '../../organization/entities/warehouse.entity';
import { ProductVariant } from '../../products/entities/product-variant.entity';
import { Company } from '../../organization/entities/company.entity';
import { User } from '../../users/entities/user.entity';
import { StockAdjustmentReason } from './stock-adjustment-reason.enum';

/**
 * StockAdjustment — single-line flat model (Phase 14 locked decision
 * D10/D11). Section 9's literal field list (warehouseId/productVariantId/
 * quantityChange directly on StockAdjustment) is followed over section 3's
 * higher-level entity list, which mentioned a StockAdjustmentItem —
 * deliberately no StockAdjustmentItem table exists. Creation immediately
 * mutates stock; no update/delete endpoint, no approval workflow, no state
 * machine. Opening stock is modeled as reason = OPENING_BALANCE, not a
 * separate entity.
 */
@Entity('stock_adjustments')
export class StockAdjustment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'adjustment_number', type: 'varchar', length: 50 })
  adjustmentNumber!: string;

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

  @Column({ name: 'quantity_change', type: 'int' })
  quantityChange!: number;

  @Index()
  @Column({
    name: 'reason',
    type: 'enum',
    enum: StockAdjustmentReason,
  })
  reason!: StockAdjustmentReason;

  @Index()
  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Column({ name: 'notes', type: 'varchar', length: 1000, nullable: true })
  notes!: string | null;

  @Column({ name: 'created_by', type: 'char', length: 36 })
  createdBy!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  createdByUser!: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}
