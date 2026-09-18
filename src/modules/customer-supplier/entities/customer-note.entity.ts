import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from '../../organization/entities/company.entity';
import { Customer } from './customer.entity';
import { User } from '../../users/entities/user.entity';

@Entity('customer_notes')
@Index(['customerId'])
@Index(['companyId'])
export class CustomerNote extends BaseEntity {
  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Column({ name: 'customer_id', type: 'char', length: 36 })
  customerId!: string;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer!: Customer;

  @Column({ name: 'user_id', type: 'char', length: 36 })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'note_type', type: 'varchar', length: 32, default: 'NOTE' })
  noteType!: string;

  @Column({ name: 'content', type: 'text' })
  content!: string;
}
