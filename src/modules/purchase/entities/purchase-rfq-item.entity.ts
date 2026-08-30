import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import {
  CreateDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PurchaseRfq } from './purchase-rfq.entity';
import { ProductVariant } from '../../products/entities/product-variant.entity';

@Entity('purchase_rfq_items')
export class PurchaseRfqItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'purchase_rfq_id', type: 'char', length: 36 })
  purchaseRfqId!: string;

  @ManyToOne(() => PurchaseRfq, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_rfq_id' })
  purchaseRfq!: PurchaseRfq;

  @Index()
  @Column({ name: 'product_variant_id', type: 'char', length: 36 })
  productVariantId!: string;

  @ManyToOne(() => ProductVariant, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_variant_id' })
  productVariant!: ProductVariant;

  @Column({ name: 'quantity', type: 'int' })
  quantity!: number;

  @Column({ name: 'reason_snapshot', type: 'varchar', length: 255 })
  reasonSnapshot!: string;

  @Column({ name: 'product_name_snapshot', type: 'varchar', length: 200 })
  productNameSnapshot!: string;

  @Column({ name: 'sku_snapshot', type: 'varchar', length: 100 })
  skuSnapshot!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}
