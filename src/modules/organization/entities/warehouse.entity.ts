import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Company } from './company.entity';
import { Branch } from './branch.entity';
import { WarehouseStatus } from './warehouse-status.enum';
import { WarehouseType } from './warehouse-type.enum';

/**
 * companyId is stored directly (denormalized from branch.companyId) rather
 * than derived via a join every read — Phase 07 §11 lists companyId as a
 * first-class Warehouse column, and §12 makes "warehouse.companyId must
 * equal branch.companyId" a service-enforced invariant, checked on every
 * create/update rather than relied upon implicitly. companyId/branchId are
 * both immutable after creation, matching Branch.companyId's immutability
 * for the same reason (§64) — a real transfer is a dedicated future
 * operation, not a PATCH.
 */
@Entity('warehouses')
@Index(['companyId', 'code'], { unique: true })
export class Warehouse extends BaseEntity {
  @Column({ name: 'company_id', type: 'char', length: 36 })
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Column({ name: 'branch_id', type: 'char', length: 36 })
  branchId!: string;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branch_id' })
  branch!: Branch;

  @Column({ name: 'code', type: 'varchar', length: 50 })
  code!: string;

  @Column({ name: 'name', type: 'varchar', length: 200 })
  name!: string;

  @Index()
  @Column({
    name: 'type',
    type: 'enum',
    enum: WarehouseType,
    default: WarehouseType.Main,
  })
  type!: WarehouseType;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: WarehouseStatus,
    default: WarehouseStatus.Active,
  })
  status!: WarehouseStatus;

  @Column({ name: 'address', type: 'varchar', length: 500, nullable: true })
  address!: string | null;
}
