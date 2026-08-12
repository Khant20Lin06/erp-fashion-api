import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesAccountAssignment } from '../entities/sales-account-assignment.entity';
import { SalesAccountAssignmentStatus } from '../entities/sales-account-assignment-status.enum';

/**
 * Sales-domain ownership resolution, deliberately separate from
 * DataScopeService (Phase 08 §74-78 LOCKED — "do not make generic
 * DataScope responsible for every business-specific rule"). Answers
 * "which sales accounts is this user authorized to operate," derived from
 * active SalesAccountAssignment rows only. Phase 12 combines this with
 * permission + DataScope's organization scope to compute actual sales
 * visibility (§43, §75, §146) — this service does not implement any Sales
 * filtering itself.
 */
@Injectable()
export class SalesAccountAccessService {
  constructor(
    @InjectRepository(SalesAccountAssignment)
    private readonly assignmentRepository: Repository<SalesAccountAssignment>,
  ) {}

  async getAllowedSalesAccountIds(userId: string): Promise<string[]> {
    const assignments = await this.assignmentRepository.find({
      where: { userId, status: SalesAccountAssignmentStatus.Active },
    });

    return assignments.map((assignment) => assignment.salesAccountId);
  }

  async canAccessSalesAccount(
    userId: string,
    salesAccountId: string,
  ): Promise<boolean> {
    const assignment = await this.assignmentRepository.findOne({
      where: {
        userId,
        salesAccountId,
        status: SalesAccountAssignmentStatus.Active,
      },
    });
    return assignment !== null;
  }
}
