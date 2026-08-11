import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { UserStatus } from './user-status.enum';

@Entity('users')
export class User extends BaseEntity {
  @Column({ name: 'email', type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ name: 'first_name', type: 'varchar', length: 100 })
  firstName!: string;

  @Column({ name: 'last_name', type: 'varchar', length: 100 })
  lastName!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 200 })
  displayName!: string;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.Active,
  })
  status!: UserStatus;

  @Column({ name: 'is_email_verified', type: 'boolean', default: false })
  isEmailVerified!: boolean;

  @Column({ name: 'last_login_at', type: 'timestamp', nullable: true })
  lastLoginAt!: Date | null;

  @Column({ name: 'password_changed_at', type: 'timestamp', nullable: true })
  passwordChangedAt!: Date | null;
}
