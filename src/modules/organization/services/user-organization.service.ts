import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserCompany } from '../entities/user-company.entity';
import { UserBranch } from '../entities/user-branch.entity';
import { UserWarehouse } from '../entities/user-warehouse.entity';
import { MembershipStatus } from '../entities/membership-status.enum';
import { CompaniesService } from './companies.service';
import { BranchesService } from './branches.service';
import { WarehousesService } from './warehouses.service';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';

/**
 * Organizational membership — WHERE a user can operate (Phase 08 §3, §20).
 * Never grants permission by itself; combines with Role/Permission (WHAT)
 * and DataScope (WHICH records) at query time. Membership does not replace
 * RBAC — see DataScopeService's resolution methods for the actual
 * visibility computation this membership data feeds.
 */
@Injectable()
export class UserOrganizationService {
  constructor(
    @InjectRepository(UserCompany)
    private readonly userCompanyRepository: Repository<UserCompany>,
    @InjectRepository(UserBranch)
    private readonly userBranchRepository: Repository<UserBranch>,
    @InjectRepository(UserWarehouse)
    private readonly userWarehouseRepository: Repository<UserWarehouse>,
    private readonly companiesService: CompaniesService,
    private readonly branchesService: BranchesService,
    private readonly warehousesService: WarehousesService,
    private readonly transactionService: TransactionService,
  ) {}

  async listCompanyMemberships(userId: string): Promise<UserCompany[]> {
    return this.userCompanyRepository.find({ where: { userId } });
  }

  async listBranchMemberships(userId: string): Promise<UserBranch[]> {
    return this.userBranchRepository.find({ where: { userId } });
  }

  async listWarehouseMemberships(userId: string): Promise<UserWarehouse[]> {
    return this.userWarehouseRepository.find({ where: { userId } });
  }

  /**
   * companyId is validated against a real, active Company (never trusted
   * from the client beyond using it as a lookup key, Phase 08 §22).
   */
  async assignCompany(userId: string, companyId: string): Promise<UserCompany> {
    const company = await this.companiesService.findActiveByIdOrNull(companyId);
    if (!company) {
      throw new AppException(
        ErrorCode.ValidationError,
        'companyId does not reference an active company',
      );
    }

    const existing = await this.userCompanyRepository.findOne({
      where: { userId, companyId },
    });
    if (existing) {
      throw new AppException(
        ErrorCode.Conflict,
        'User is already a member of this company',
      );
    }

    const membership = this.userCompanyRepository.create({
      userId,
      companyId,
      status: MembershipStatus.Active,
      isPrimary: false,
    });
    return this.userCompanyRepository.save(membership);
  }

  async removeCompanyMembership(
    userId: string,
    companyId: string,
  ): Promise<void> {
    const membership = await this.userCompanyRepository.findOne({
      where: { userId, companyId },
    });
    if (!membership) {
      throw new AppException(ErrorCode.NotFound, 'Membership not found');
    }
    await this.userCompanyRepository.softRemove(membership);
  }

  /**
   * Company-before-branch rule (Phase 08 §4, LOCKED): a Branch membership
   * requires an existing active Company membership for that branch's own
   * parent company. Runs in a transaction since it reads company membership
   * then writes branch membership — the two must be seen consistently.
   */
  async assignBranch(userId: string, branchId: string): Promise<UserBranch> {
    return this.transactionService.run(async (manager) => {
      const branch = await this.branchesService.findActiveByIdOrNull(branchId);
      if (!branch) {
        throw new AppException(
          ErrorCode.ValidationError,
          'branchId does not reference an active branch',
        );
      }

      const companyMembership = await manager.findOne(UserCompany, {
        where: {
          userId,
          companyId: branch.companyId,
          status: MembershipStatus.Active,
        },
      });
      if (!companyMembership) {
        throw new AppException(
          ErrorCode.ValidationError,
          "User must have an active membership in the branch's company before being assigned to the branch",
        );
      }

      const existing = await manager.findOne(UserBranch, {
        where: { userId, branchId },
      });
      if (existing) {
        throw new AppException(
          ErrorCode.Conflict,
          'User is already a member of this branch',
        );
      }

      const membership = manager.create(UserBranch, {
        userId,
        branchId,
        status: MembershipStatus.Active,
        isPrimary: false,
      });
      return manager.save(membership);
    });
  }

  async removeBranchMembership(
    userId: string,
    branchId: string,
  ): Promise<void> {
    const membership = await this.userBranchRepository.findOne({
      where: { userId, branchId },
    });
    if (!membership) {
      throw new AppException(ErrorCode.NotFound, 'Membership not found');
    }
    await this.userBranchRepository.softRemove(membership);
  }

  /**
   * Warehouse membership integrity (Phase 08 §5, LOCKED): must be
   * consistent with Warehouse -> Branch -> Company. Requires an active
   * Branch membership for the warehouse's actual parent branch — never
   * trusts a client-provided warehouseId beyond using it to look up the
   * real row and its real parent chain server-side.
   */
  async assignWarehouse(
    userId: string,
    warehouseId: string,
  ): Promise<UserWarehouse> {
    return this.transactionService.run(async (manager) => {
      const warehouse = await this.warehousesService.findById(warehouseId);

      const branchMembership = await manager.findOne(UserBranch, {
        where: {
          userId,
          branchId: warehouse.branchId,
          status: MembershipStatus.Active,
        },
      });
      if (!branchMembership) {
        throw new AppException(
          ErrorCode.ValidationError,
          "User must have an active membership in the warehouse's branch before being assigned to the warehouse",
        );
      }

      const existing = await manager.findOne(UserWarehouse, {
        where: { userId, warehouseId },
      });
      if (existing) {
        throw new AppException(
          ErrorCode.Conflict,
          'User is already a member of this warehouse',
        );
      }

      const membership = manager.create(UserWarehouse, {
        userId,
        warehouseId,
        status: MembershipStatus.Active,
        isPrimary: false,
      });
      return manager.save(membership);
    });
  }

  async removeWarehouseMembership(
    userId: string,
    warehouseId: string,
  ): Promise<void> {
    const membership = await this.userWarehouseRepository.findOne({
      where: { userId, warehouseId },
    });
    if (!membership) {
      throw new AppException(ErrorCode.NotFound, 'Membership not found');
    }
    await this.userWarehouseRepository.softRemove(membership);
  }
}
