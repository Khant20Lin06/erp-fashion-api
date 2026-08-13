import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Supplier } from './supplier.entity';
import { AddressType } from './address-type.enum';

/** Separate table dedicated to Supplier, mirroring CustomerAddress exactly — see its docblock. */
@Entity('supplier_addresses')
export class SupplierAddress extends BaseEntity {
  @Column({ name: 'supplier_id', type: 'char', length: 36 })
  @Index()
  supplierId!: string;

  @ManyToOne(() => Supplier, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplier_id' })
  supplier!: Supplier;

  @Column({
    name: 'label',
    type: 'enum',
    enum: AddressType,
    default: AddressType.Other,
  })
  label!: AddressType;

  @Column({
    name: 'recipient_name',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  recipientName!: string | null;

  @Column({ name: 'address_line1', type: 'varchar', length: 255 })
  addressLine1!: string;

  @Column({
    name: 'address_line2',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  addressLine2!: string | null;

  @Column({ name: 'city', type: 'varchar', length: 100, nullable: true })
  city!: string | null;

  @Column({ name: 'state', type: 'varchar', length: 100, nullable: true })
  state!: string | null;

  @Column({ name: 'postal_code', type: 'varchar', length: 20, nullable: true })
  postalCode!: string | null;

  @Column({ name: 'country', type: 'varchar', length: 100, nullable: true })
  country!: string | null;

  @Column({ name: 'phone', type: 'varchar', length: 50, nullable: true })
  phone!: string | null;

  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary!: boolean;
}
