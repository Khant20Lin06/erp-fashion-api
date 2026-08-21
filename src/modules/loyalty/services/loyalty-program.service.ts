import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { LoyaltyProgram } from '../entities/loyalty-program.entity';
import { CompaniesService } from '../../organization/services/companies.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import { UpsertLoyaltyProgramDto } from '../dto/loyalty-program.dto';

@Injectable()
export class LoyaltyProgramService {
  constructor(
    @InjectRepository(LoyaltyProgram)
    private readonly programRepository: Repository<LoyaltyProgram>,
    private readonly companiesService: CompaniesService,
  ) {}

  async findByCompanyIdOrNull(
    companyId: string,
  ): Promise<LoyaltyProgram | null> {
    return this.programRepository.findOne({ where: { companyId } });
  }

  /** Fails closed — a Sale can only earn points if the company has explicitly configured and activated a program. */
  async getActiveProgramOrNull(
    manager: EntityManager,
    companyId: string,
  ): Promise<LoyaltyProgram | null> {
    const program = await manager.findOne(LoyaltyProgram, {
      where: { companyId },
    });
    if (!program || !program.isActive) {
      return null;
    }
    return program;
  }

  async upsert(
    companyId: string,
    userId: string,
    dto: UpsertLoyaltyProgramDto,
  ): Promise<LoyaltyProgram> {
    const company = await this.companiesService.findActiveByIdOrNull(companyId);
    if (!company) {
      throw new AppException(
        ErrorCode.ValidationError,
        'companyId does not reference an active company',
      );
    }

    const existing = await this.programRepository.findOne({
      where: { companyId },
    });
    if (existing) {
      existing.pointsPerCurrencyUnit = dto.pointsPerCurrencyUnit;
      existing.redemptionValuePerPoint = dto.redemptionValuePerPoint;
      if (dto.minimumPurchaseForEarning !== undefined) {
        existing.minimumPurchaseForEarning = dto.minimumPurchaseForEarning;
      }
      if (dto.isActive !== undefined) existing.isActive = dto.isActive;
      existing.updatedBy = userId;
      return this.programRepository.save(existing);
    }

    const entity = this.programRepository.create({
      companyId,
      pointsPerCurrencyUnit: dto.pointsPerCurrencyUnit,
      redemptionValuePerPoint: dto.redemptionValuePerPoint,
      minimumPurchaseForEarning: dto.minimumPurchaseForEarning ?? '0.00',
      isActive: dto.isActive ?? true,
      createdBy: userId,
      updatedBy: userId,
    });
    return this.programRepository.save(entity);
  }
}
