import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { PayrollConfiguration } from '../entities/payroll-configuration.entity';
import { UnpaidLeaveCalculation } from '../entities/unpaid-leave-calculation.enum';
import { CompaniesService } from '../../organization/services/companies.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { UpsertPayrollConfigurationDto } from '../dto/payroll-configuration.dto';

@Injectable()
export class PayrollConfigurationService {
  constructor(
    @InjectRepository(PayrollConfiguration)
    private readonly configRepository: Repository<PayrollConfiguration>,
    private readonly companiesService: CompaniesService,
    private readonly transactionService: TransactionService,
  ) {}

  async findByCompanyIdOrNull(
    companyId: string,
  ): Promise<PayrollConfiguration | null> {
    return this.configRepository.findOne({ where: { companyId } });
  }

  async getRequiredForCalculation(
    manager: EntityManager,
    companyId: string,
  ): Promise<PayrollConfiguration> {
    const config = await manager.findOne(PayrollConfiguration, {
      where: { companyId },
    });
    if (!config) {
      throw new AppException(
        ErrorCode.UnprocessableEntity,
        'Payroll configuration has not been set up for this company',
      );
    }
    return config;
  }

  async upsert(
    companyId: string,
    userId: string,
    dto: UpsertPayrollConfigurationDto,
  ): Promise<PayrollConfiguration> {
    const company = await this.companiesService.findActiveByIdOrNull(companyId);
    if (!company) {
      throw new AppException(
        ErrorCode.ValidationError,
        'companyId does not reference an active company',
      );
    }

    if (
      dto.unpaidLeaveCalculation === UnpaidLeaveCalculation.DailyRate &&
      !dto.workingDaysPerMonth
    ) {
      throw new AppException(
        ErrorCode.ValidationError,
        'workingDaysPerMonth is required when unpaidLeaveCalculation is DAILY_RATE',
      );
    }

    return this.transactionService.run(async (manager) => {
      const existing = await manager.findOne(PayrollConfiguration, {
        where: { companyId },
      });

      if (existing) {
        existing.defaultCurrency = dto.defaultCurrency;
        existing.unpaidLeaveCalculation = dto.unpaidLeaveCalculation;
        existing.workingDaysPerMonth =
          dto.unpaidLeaveCalculation === UnpaidLeaveCalculation.DailyRate
            ? dto.workingDaysPerMonth!
            : null;
        existing.updatedBy = userId;
        return manager.save(PayrollConfiguration, existing);
      }

      const entity = manager.create(PayrollConfiguration, {
        companyId,
        defaultCurrency: dto.defaultCurrency,
        unpaidLeaveCalculation: dto.unpaidLeaveCalculation,
        workingDaysPerMonth:
          dto.unpaidLeaveCalculation === UnpaidLeaveCalculation.DailyRate
            ? dto.workingDaysPerMonth!
            : null,
        createdBy: userId,
        updatedBy: userId,
      });
      return manager.save(PayrollConfiguration, entity);
    });
  }
}
