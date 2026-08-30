import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import {
  CreateDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PurchaseReturn } from './purchase-return.entity';
import { PurchaseOrderItem } from './purchase-order-item.entity';
import { ProductVariant } from '../../products/entities/product-variant.entity';

@Entity('purchase_return_items')
export class PurchaseReturnItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'purchase_return_id', type: 'char', length: 36 })
  purchaseReturnId!: string;

  @ManyToOne(() => PurchaseReturn, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_return_id' })
  purchaseReturn!: PurchaseReturn;

  @Index()
  @Column({ name: 'purchase_order_item_id', type: 'char', length: 36 })
  purchaseOrderItemId!: string;

  @ManyToOne(() => PurchaseOrderItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'purchase_order_item_id' })
  purchaseOrderItem!: PurchaseOrderItem;

  @Index()
  @Column({ name: 'product_variant_id', type: 'char', length: 36 })
  productVariantId!: string;

  @ManyToOne(() => ProductVariant, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_variant_id' })
  productVariant!: ProductVariant;

  @Column({ name: 'quantity', type: 'int' })
  quantity!: number;

  @Column({
    name: 'unit_cost_snapshot',
    type: 'decimal',
    precision: 14,
    scale: 2,
  })
  unitCostSnapshot!: string;

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
