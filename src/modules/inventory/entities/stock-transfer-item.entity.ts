import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { PrimaryGeneratedColumn } from 'typeorm';
import { StockTransfer } from './stock-transfer.entity';
import { ProductVariant } from '../../products/entities/product-variant.entity';

/**
 * StockTransfer line item (Phase 14 locked decision D9). No independent
 * soft-delete — mirrors SaleItem/PurchaseOrderItem/GoodsReceiptItem.
 * stock_transfer_id is CASCADE; product_variant_id is RESTRICT.
 */
@Entity('stock_transfer_items')
export class StockTransferItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'stock_transfer_id', type: 'char', length: 36 })
  stockTransferId!: string;

  @ManyToOne(() => StockTransfer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stock_transfer_id' })
  stockTransfer!: StockTransfer;

  @Index()
  @Column({ name: 'product_variant_id', type: 'char', length: 36 })
  productVariantId!: string;

  @ManyToOne(() => ProductVariant, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_variant_id' })
  productVariant!: ProductVariant;

  @Column({ name: 'quantity', type: 'int' })
  quantity!: number;
}
