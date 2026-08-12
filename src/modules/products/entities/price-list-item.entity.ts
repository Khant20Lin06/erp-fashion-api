import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';
import { PriceList } from './price-list.entity';
import { ProductVariant } from './product-variant.entity';
import { PriceListItemStatus } from './price-list-item-status.enum';

/**
 * Effective-dated price for one ProductVariant within one PriceList (Phase
 * 10 §Price List Rules / §Price History, LOCKED). Rows are never edited
 * retroactively — a price change closes the current row's validTo and
 * inserts a new one (service-level, inside a transaction). Overlap
 * prevention for the same (priceListId, productVariantId) is enforced at
 * the service layer; the unique index below is the database backstop
 * against a concurrent-write race creating two rows with the exact same
 * validFrom, not a full range-overlap constraint (MySQL cannot express
 * range exclusion natively).
 */
@Entity('price_list_items')
@Index(['priceListId', 'productVariantId', 'validFrom'], { unique: true })
export class PriceListItem extends BaseEntity {
  @Column({ name: 'price_list_id', type: 'char', length: 36 })
  priceListId!: string;

  @ManyToOne(() => PriceList, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'price_list_id' })
  priceList!: PriceList;

  @Column({ name: 'product_variant_id', type: 'char', length: 36 })
  productVariantId!: string;

  @ManyToOne(() => ProductVariant, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_variant_id' })
  productVariant!: ProductVariant;

  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Column({ name: 'price', type: 'decimal', precision: 12, scale: 2 })
  price!: string;

  @Column({ name: 'valid_from', type: 'timestamp' })
  validFrom!: Date;

  @Column({ name: 'valid_to', type: 'timestamp', nullable: true })
  validTo!: Date | null;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: PriceListItemStatus,
    default: PriceListItemStatus.Active,
  })
  status!: PriceListItemStatus;
}
