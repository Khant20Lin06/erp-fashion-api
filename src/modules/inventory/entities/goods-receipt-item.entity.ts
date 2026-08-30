import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { GoodsReceipt } from './goods-receipt.entity';
import { PurchaseOrderItem } from '../../purchase/entities/purchase-order-item.entity';
import { ProductVariant } from '../../products/entities/product-variant.entity';
import { Uom } from '../../uom/entities/uom.entity';

/**
 * GoodsReceipt line item (Phase 14 locked decision D2). productVariantId is
 * denormalized from the referenced PurchaseOrderItem for direct query
 * convenience, but is always validated server-side to actually match
 * purchaseOrderItem.productVariantId — a client cannot receive against the
 * wrong variant by supplying a mismatched pair.
 *
 * No independent soft-delete (mirrors SaleItem/PurchaseOrderItem) — own
 * id/createdAt/updatedAt, no BaseEntity. goods_receipt_id is CASCADE (a
 * GoodsReceiptItem is meaningless without its parent);
 * purchase_order_item_id/product_variant_id are RESTRICT.
 *
 * unitCostSnapshot is deliberately omitted (D16) — the locked spec frames
 * it as "MAY preserve," not "MUST," and including it risked being read as
 * valuation logic (no cost/value aggregation exists anywhere in this
 * module). PurchaseOrderItem.unitCostSnapshot remains queryable via the
 * purchaseOrderItemId FK for any future phase that needs it.
 */
@Entity('goods_receipt_items')
export class GoodsReceiptItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'goods_receipt_id', type: 'char', length: 36 })
  goodsReceiptId!: string;

  @ManyToOne(() => GoodsReceipt, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'goods_receipt_id' })
  goodsReceipt!: GoodsReceipt;

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

  @Column({ name: 'received_quantity', type: 'int' })
  receivedQuantity!: number;

  @Column({ name: 'rejected_quantity', type: 'int', default: 0 })
  rejectedQuantity!: number;

  @Column({
    name: 'conversion_factor_to_base_snapshot',
    type: 'decimal',
    precision: 14,
    scale: 4,
    default: 1,
  })
  conversionFactorToBaseSnapshot!: string;

  @Column({ name: 'base_received_quantity', type: 'int', default: 0 })
  baseReceivedQuantity!: number;

  @Column({ name: 'base_rejected_quantity', type: 'int', default: 0 })
  baseRejectedQuantity!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}
