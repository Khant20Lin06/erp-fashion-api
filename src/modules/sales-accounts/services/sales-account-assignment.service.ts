import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesAccountAssignment } from '../entities/sales-account-assignment.entity';
import { SalesAccountAssignmentStatus } from '../entities/sales-account-assignment-status.enum';
import { SalesAccount } from '../entities/sales-account.entity';
import { SalesAccountStatus } from '../entities/sales-account-status.enum';
import { Employee } from '../../employees/entities/employee.entity';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';

/**
 * Normalized ownership relationship, history-preserving (Phase 08 §32-36,
 * §97). Reassignment never overwrites a row — it deactivates the old
 * assignment and creates a new one, so "who owned this account at the time
 * of sale" remains answerable later. Grants no permission by itself; see
 * SalesAccountAccessService for how this feeds Phase 12's visibility.
 */
@Injectable()
export class SalesAccountAssignmentService {
  constructor(
    @InjectRepository(SalesAccountAssignment)
    private readonly assignmentRepository: Repository<SalesAccountAssignment>,
    @InjectRepository(SalesAccount)
    private readonly salesAccountRepository: Repository<SalesAccount>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    private readonly transactionService: TransactionService,
  ) {}

  async listForAccount(
    salesAccountId: string,
  ): Promise<SalesAccountAssignment[]> {
    return this.assignmentRepository.find({ where: { salesAccountId } });
  }

  /**
   * Cross-company/cross-branch validation (Phase 08 §56-57, §93-94): the
   * assigned employee must belong to the same company as the sales
   * account (and, if the account is branch-scoped, the same branch).
   * Inactive accounts cannot receive new assignments (§39, §103, §137).
   * Duplicate active assignment for the same (userId, salesAccountId) pair
   * is rejected (§100 unique-primary-style invariant, enforced at service
   * level since MySQL has no native partial unique index).
   */
  async assign(
    salesAccountId: string,
    userId: string,
    employeeId: string,
  ): Promise<SalesAccountAssignment> {
    return this.transactionService.run(async (manager) => {
      const account = await manager.findOne(SalesAccount, {
        where: { id: salesAccountId, status: SalesAccountStatus.Active },
      });
      if (!account) {
        throw new AppException(
          ErrorCode.ValidationError,
          'salesAccountId does not reference an active sales account',
        );
      }

      const employee = await manager.findOne(Employee, {
        where: { id: employeeId },
      });
      if (!employee) {
        throw new AppException(
          ErrorCode.ValidationError,
          'employeeId does not reference an existing employee',
        );
      }

      if (employee.companyId !== account.companyId) {
        throw new AppException(
          ErrorCode.ValidationError,
          "employee does not belong to the sales account's company",
        );
      }
      if (employee.branchId !== account.branchId) {
        throw new AppException(
          ErrorCode.ValidationError,
          "employee does not belong to the sales account's branch",
        );
      }
      if (employee.userId !== userId) {
        throw new AppException(
          ErrorCode.ValidationError,
          "userId does not match the specified employee's linked user",
        );
      }

      const existingActive = await manager.findOne(SalesAccountAssignment, {
        where: {
          userId,
          salesAccountId,
          status: SalesAccountAssignmentStatus.Active,
        },
      });
      if (existingActive) {
        throw new AppException(
          ErrorCode.Conflict,
          'User already has an active assignment to this sales account',
        );
      }

      const assignment = manager.create(SalesAccountAssignment, {
        userId,
        employeeId,
        salesAccountId,
        status: SalesAccountAssignmentStatus.Active,
        isPrimary: false,
        assignedAt: new Date(),
        unassignedAt: null,
      });

      return manager.save(assignment);
    });
  }

  /**
   * Unassignment sets unassignedAt and INACTIVE status — the row is never
   * deleted, preserving history (§97).
   */
  async unassign(assignmentId: string): Promise<void> {
    const assignment = await this.assignmentRepository.findOne({
      where: { id: assignmentId },
    });
    if (!assignment) {
      throw new AppException(ErrorCode.NotFound, 'Assignment not found');
    }

    assignment.status = SalesAccountAssignmentStatus.Inactive;
    assignment.unassignedAt = new Date();
    await this.assignmentRepository.save(assignment);
  }
}
