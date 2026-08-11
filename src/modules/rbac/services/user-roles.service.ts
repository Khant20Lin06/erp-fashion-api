import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../entities/user-role.entity';
import { Role } from '../entities/role.entity';
import { User } from '../../users/entities/user.entity';
import { ReplaceUserRolesDto } from '../dto/replace-user-roles.dto';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { SuperAdminInvariantService } from './super-admin-invariant.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';

@Injectable()
export class UserRolesService {
  constructor(
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    private readonly transactionService: TransactionService,
    private readonly superAdminInvariant: SuperAdminInvariantService,
  ) {}

  async listForUser(userId: string): Promise<Role[]> {
    const userRoles = await this.userRoleRepository.find({
      where: { userId },
      relations: { role: true },
    });

    return userRoles.map((userRole) => userRole.role);
  }

  /**
   * Replaces a user's entire role set atomically. The removal half of this
   * operation can strip a user's last Super Admin role, so the invariant
   * check runs inside the same transaction after the new assignment set is
   * written (Phase 06 §9 / §67).
   */
  async replaceForUser(
    userId: string,
    dto: ReplaceUserRolesDto,
  ): Promise<Role[]> {
    await this.transactionService.run(async (manager) => {
      const user = await manager.findOne(User, { where: { id: userId } });
      if (!user) {
        throw new AppException(ErrorCode.NotFound, 'User not found');
      }

      if (dto.roleIds.length > 0) {
        const foundRoles = await manager.find(Role, {
          where: dto.roleIds.map((roleId) => ({ id: roleId })),
        });
        if (foundRoles.length !== dto.roleIds.length) {
          throw new AppException(
            ErrorCode.ValidationError,
            'One or more role ids do not exist',
          );
        }
      }

      await manager.delete(UserRole, { userId });

      const newUserRoles = dto.roleIds.map((roleId) =>
        manager.create(UserRole, { userId, roleId }),
      );
      if (newUserRoles.length > 0) {
        await manager.save(newUserRoles);
      }

      await this.superAdminInvariant.assertAtLeastOneActiveSuperAdminRemains(
        manager,
      );
    });

    return this.listForUser(userId);
  }
}
