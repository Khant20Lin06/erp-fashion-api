import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { ProductVariant } from '../../products/entities/product-variant.entity';
import { PurchaseRequest } from './purchase-request.entity';

@Entity('purchase_request_items')
export class PurchaseRequestItem extends BaseEntity {
  @Index()
  @Column({ name: 'purchase_request_id', type: 'char', length: 36 })
  purchaseRequestId!: string;

  @ManyToOne(() => PurchaseRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_request_id' })
  purchaseRequest!: PurchaseRequest;

  @Index()
  @Column({ name: 'product_variant_id', type: 'char', length: 36 })
  productVariantId!: string;

  @ManyToOne(() => ProductVariant, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_variant_id' })
  productVariant!: ProductVariant;

  @Column({ name: 'quantity', type: 'int' })
  quantity!: number;

  @Column({ name: 'reason', type: 'varchar', length: 255 })
  reason!: string;

  @Column({ name: 'product_name_snapshot', type: 'varchar', length: 200 })
  productNameSnapshot!: string;

  @Column({ name: 'sku_snapshot', type: 'varchar', length: 100 })
  skuSnapshot!: string;
}
