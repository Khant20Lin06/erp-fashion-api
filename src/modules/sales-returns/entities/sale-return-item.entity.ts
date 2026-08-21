import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SaleReturn } from './sale-return.entity';
import { SaleItem } from '../../sales/entities/sale-item.entity';
import { ProductVariant } from '../../products/entities/product-variant.entity';
import { SaleReturnItemCondition } from './sale-return-item-condition.enum';

/**
 * SaleReturnItem — one returned line against a specific SaleItem.
 * Snapshot-only, mirrors SaleItem's own shape: no BaseEntity (own id/
 * createdAt only, no soft-delete, no independent update after creation).
 * saleItemId is RESTRICT (never let a SaleItem disappear out from under a
 * historical return record — SaleItems are never hard-deleted anyway).
 *
 * quantity is validated against `SaleItem.quantity - SUM(previously
 * returned quantity for this saleItemId)` at creation time inside a locked
 * transaction (see SaleReturnsService.create()) — never trusted from the
 * client beyond that check.
 */
@Entity('sale_return_items')
export class SaleReturnItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'sale_return_id', type: 'char', length: 36 })
  saleReturnId!: string;

  @ManyToOne(() => SaleReturn, (saleReturn) => saleReturn.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sale_return_id' })
  saleReturn!: SaleReturn;

  @Index()
  @Column({ name: 'sale_item_id', type: 'char', length: 36 })
  saleItemId!: string;

  @ManyToOne(() => SaleItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sale_item_id' })
  saleItem!: SaleItem;

  @Index()
  @Column({ name: 'product_variant_id', type: 'char', length: 36 })
  productVariantId!: string;

  @ManyToOne(() => ProductVariant, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_variant_id' })
  productVariant!: ProductVariant;

  @Column({ name: 'quantity', type: 'int' })
  quantity!: number;

  @Column({
    name: 'unit_price_snapshot',
    type: 'decimal',
    precision: 14,
    scale: 2,
  })
  unitPriceSnapshot!: string;

  @Column({
    name: 'discount_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  discountAmount!: string;

  @Column({ name: 'line_total', type: 'decimal', precision: 14, scale: 2 })
  lineTotal!: string;

  @Column({
    name: 'condition',
    type: 'enum',
    enum: SaleReturnItemCondition,
    default: SaleReturnItemCondition.Restock,
  })
  condition!: SaleReturnItemCondition;

  @Column({ name: 'product_name_snapshot', type: 'varchar', length: 200 })
  productNameSnapshot!: string;

  @Column({ name: 'sku_snapshot', type: 'varchar', length: 100 })
  skuSnapshot!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;
}
