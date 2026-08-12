import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { ProductVariant } from './product-variant.entity';
import { AttributeOption } from '../../master-data/entities/attribute-option.entity';
import { AttributeKind } from '../../master-data/entities/attribute-kind.enum';

/**
 * Normalized join between ProductVariant and the existing Phase 09
 * AttributeOption table (Phase 10 §A, LOCKED) — dynamic, not a hard-coded
 * colorId/sizeId pair, so it supports COLOR/SIZE/STYLE/MATERIAL and any
 * future kind without a schema change. `kind` is denormalized from the
 * referenced AttributeOption at write time solely to let MySQL enforce
 * "at most one option per kind per variant" via a unique index — the
 * canonical relationship is still optionId → attribute_options.id.
 */
@Entity('product_variant_attributes')
@Index(['variantId', 'kind'], { unique: true })
export class ProductVariantAttribute extends BaseEntity {
  @Column({ name: 'variant_id', type: 'char', length: 36 })
  variantId!: string;

  @ManyToOne(() => ProductVariant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'variant_id' })
  variant!: ProductVariant;

  @Column({ name: 'option_id', type: 'char', length: 36 })
  optionId!: string;

  @ManyToOne(() => AttributeOption, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'option_id' })
  option!: AttributeOption;

  @Column({ name: 'kind', type: 'enum', enum: AttributeKind })
  kind!: AttributeKind;
}
