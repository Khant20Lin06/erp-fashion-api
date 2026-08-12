import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';
import { Category } from '../../master-data/entities/category.entity';
import { Brand } from '../../master-data/entities/brand.entity';
import { Collection } from '../../master-data/entities/collection.entity';
import { ProductStatus } from './product-status.enum';
import { ProductType } from './product-type.enum';

/**
 * The commercial/catalog concept (Phase 10 analysis §5, approved) — never
 * the stockable/sellable unit itself; that is ProductVariant. `code` is the
 * stable business identifier, distinct from ProductVariant.sku (Phase 10
 * analysis §7/D3, approved): the frontend's single "Product SKU" field maps
 * onto `code` at the DTO layer, it is not a second real SKU column here.
 * categoryId/brandId are required; collectionId stays nullable exactly as
 * Collection itself is optional in the frontend's Product model.
 */
@Entity('products')
@Index(['companyId', 'code'], { unique: true })
export class Product extends BaseEntity {
  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Column({ name: 'code', type: 'varchar', length: 50 })
  code!: string;

  @Column({ name: 'name', type: 'varchar', length: 200 })
  name!: string;

  @Column({
    name: 'description',
    type: 'varchar',
    length: 1000,
    nullable: true,
  })
  description!: string | null;

  @Column({ name: 'category_id', type: 'char', length: 36 })
  categoryId!: string;

  @ManyToOne(() => Category, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  category!: Category;

  @Column({ name: 'brand_id', type: 'char', length: 36 })
  brandId!: string;

  @ManyToOne(() => Brand, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'brand_id' })
  brand!: Brand;

  @Column({ name: 'collection_id', type: 'char', length: 36, nullable: true })
  collectionId!: string | null;

  @ManyToOne(() => Collection, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'collection_id' })
  collection?: Collection | null;

  @Column({
    name: 'product_type',
    type: 'enum',
    enum: ProductType,
    default: ProductType.Simple,
  })
  productType!: ProductType;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: ProductStatus,
    default: ProductStatus.Active,
  })
  status!: ProductStatus;
}
