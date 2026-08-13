import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Supplier } from './supplier.entity';

/** Separate table dedicated to Supplier, mirroring CustomerContact exactly — see its docblock. */
@Entity('supplier_contacts')
export class SupplierContact extends BaseEntity {
  @Column({ name: 'supplier_id', type: 'char', length: 36 })
  @Index()
  supplierId!: string;

  @ManyToOne(() => Supplier, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplier_id' })
  supplier!: Supplier;

  @Column({ name: 'name', type: 'varchar', length: 200 })
  name!: string;

  @Column({ name: 'job_title', type: 'varchar', length: 100, nullable: true })
  jobTitle!: string | null;

  @Column({ name: 'email', type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ name: 'phone', type: 'varchar', length: 50, nullable: true })
  phone!: string | null;

  @Column({ name: 'mobile', type: 'varchar', length: 50, nullable: true })
  mobile!: string | null;

  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary!: boolean;
}
