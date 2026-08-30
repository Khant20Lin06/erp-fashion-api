import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import {
  CreateDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SupplierQuotation } from './supplier-quotation.entity';
import { PurchaseRfqItem } from './purchase-rfq-item.entity';
import { ProductVariant } from '../../products/entities/product-variant.entity';

@Entity('supplier_quotation_items')
export class SupplierQuotationItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'supplier_quotation_id', type: 'char', length: 36 })
  supplierQuotationId!: string;

  @ManyToOne(() => SupplierQuotation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplier_quotation_id' })
  supplierQuotation!: SupplierQuotation;

  @Index()
  @Column({ name: 'purchase_rfq_item_id', type: 'char', length: 36 })
  purchaseRfqItemId!: string;

  @ManyToOne(() => PurchaseRfqItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'purchase_rfq_item_id' })
  purchaseRfqItem!: PurchaseRfqItem;

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

  @Column({
    name: 'discount_snapshot',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  discountSnapshot!: string;

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
