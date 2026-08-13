import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Customer } from './customer.entity';
import { AddressType } from './address-type.enum';

/**
 * Separate table dedicated to Customer, NOT a generic PartyAddress (Phase 11
 * locked decision §2). Ownership is via customer_id FK; company/owner
 * integrity is enforced server-side in CustomerAddressesService (never
 * trusts a client-supplied customerId without verifying it belongs to the
 * resolved company — Phase 11 locked decision §2/§16/§27). Soft-deleted
 * (BaseEntity.deletedAt) — owned/child data of a soft-deleted-capable parent
 * benefits from the same historical-integrity treatment, and Phase 11.md
 * §34 asks for historical integrity broadly; hard-deleting addresses that a
 * future Sales/Purchase snapshot might have referenced by id would be
 * inconsistent with that. `isPrimary` is enforced "one primary per
 * (customerId) at a time" at the service layer (assigning a new primary
 * un-sets the previous one in the same transaction), not by a DB
 * constraint (MySQL cannot express a partial/filtered unique index).
 */
@Entity('customer_addresses')
export class CustomerAddress extends BaseEntity {
  @Column({ name: 'customer_id', type: 'char', length: 36 })
  @Index()
  customerId!: string;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer!: Customer;

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
