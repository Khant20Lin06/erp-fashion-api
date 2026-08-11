import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { UserRole } from '../entities/user-role.entity';
import { Role } from '../entities/role.entity';
import { RoleStatus } from '../entities/role-status.enum';
import { UserStatus } from '../../users/entities/user-status.enum';
import { User } from '../../users/entities/user.entity';
import { SystemRoleCode } from '../entities/system-role-code';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';

/**
 * Enforces "there must always be at least one ACTIVE Super Admin".
 * Active means: the SUPER_ADMIN role itself is ACTIVE, and at least one
 * ACTIVE, non-deleted User holds it via an active UserRole assignment.
 *
 * Every check here MUST run inside the same transaction as the mutation it
 * guards (caller passes the transactional EntityManager) and MUST be
 * re-checked immediately before commit — counting before the mutation and
 * trusting that count is a race condition if two admins act concurrently.
 * The safe pattern used throughout this service is: perform the mutation
 * inside the transaction, THEN count remaining active Super Admins with the
 * SAME transactional manager, and roll back (throw) if the count is zero.
 * MySQL's row locks from the preceding writes in the same transaction make
 * this safe against concurrent invariant-violating transactions, which
 * will block on the locked rows until this transaction commits or rolls
 * back.
 */
@Injectable()
export class SuperAdminInvariantService {
  /**
   * Call AFTER performing the mutation (role deactivation, role deletion,
   * user-role removal, or user deactivation) within the same transaction.
   * Throws and causes rollback if zero active Super Admins would remain.
   */
  async assertAtLeastOneActiveSuperAdminRemains(
    manager: EntityManager,
  ): Promise<void> {
    const count = await this.countActiveSuperAdmins(manager);

    if (count === 0) {
      throw new AppException(
        ErrorCode.Conflict,
        'This action would leave the system with no active Super Admin.',
      );
    }
  }

  private async countActiveSuperAdmins(
    manager: EntityManager,
  ): Promise<number> {
    const result = await manager
      .createQueryBuilder(UserRole, 'userRole')
      .innerJoin(Role, 'role', 'role.id = userRole.roleId')
      .innerJoin(User, 'user', 'user.id = userRole.userId')
      .where('role.code = :code', { code: SystemRoleCode.SuperAdmin })
      .andWhere('role.status = :roleStatus', {
        roleStatus: RoleStatus.Active,
      })
      .andWhere('role.deletedAt IS NULL')
      .andWhere('user.status = :userStatus', {
        userStatus: UserStatus.Active,
      })
      .andWhere('user.deletedAt IS NULL')
      .andWhere('userRole.deletedAt IS NULL')
      .getCount();

    return result;
  }
}
