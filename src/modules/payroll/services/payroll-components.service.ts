import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { PayrollComponent } from '../entities/payroll-component.entity';
import { EmployeePayrollComponent } from '../entities/employee-payroll-component.entity';
import { PayrollRunEmployeeItem } from '../entities/payroll-run-employee-item.entity';
import { PayrollCalculationType } from '../entities/payroll-calculation-type.enum';
import { CompaniesService } from '../../organization/services/companies.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { resolveSortField } from '../../../shared/dto/resolve-sort-field';
import {
  CreatePayrollComponentDto,
  ListPayrollComponentsDto,
  type PayrollComponentUsageDto,
  UpdatePayrollComponentDto,
} from '../dto/payroll-components.dto';

const SORTABLE_FIELDS = ['createdAt', 'name', 'code', 'type'] as const;

@Injectable()
export class PayrollComponentsService {
  constructor(
    @InjectRepository(PayrollComponent)
    private readonly componentRepository: Repository<PayrollComponent>,
    @InjectRepository(EmployeePayrollComponent)
    private readonly employeeComponentRepository: Repository<EmployeePayrollComponent>,
    @InjectRepository(PayrollRunEmployeeItem)
    private readonly runItemRepository: Repository<PayrollRunEmployeeItem>,
    private readonly companiesService: CompaniesService,
  ) {}

  async findAll(
    companyId: string,
    query: ListPayrollComponentsDto,
  ): Promise<{
    data: PayrollComponent[];
    meta: { page: number; limit: number; total: number };
  }> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const sortField = resolveSortField(query.sort, SORTABLE_FIELDS, 'name');

    const qb = this.componentRepository
      .createQueryBuilder('component')
      .where('component.companyId = :companyId', { companyId });

    if (query.type) {
      qb.andWhere('component.type = :type', { type: query.type });
    }
    if (query.isActive !== undefined) {
      qb.andWhere('component.isActive = :isActive', {
        isActive: query.isActive,
      });
    }
    if (query.search) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('component.name LIKE :search', {
              search: `%${query.search}%`,
            })
            .orWhere('component.code LIKE :search', {
              search: `%${query.search}%`,
            });
        }),
      );
    }

    qb.orderBy(`component.${sortField}`, query.order ?? 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { page, limit, total } };
  }

  async findByIdInCompany(
    id: string,
    companyId: string,
  ): Promise<PayrollComponent> {
    const entity = await this.componentRepository.findOne({
      where: { id, companyId },
    });
    if (!entity) {
      throw new AppException(ErrorCode.NotFound, 'Payroll component not found');
    }
    return entity;
  }

  async create(
    companyId: string,
    userId: string,
    dto: CreatePayrollComponentDto,
  ): Promise<PayrollComponent> {
    const company = await this.companiesService.findActiveByIdOrNull(companyId);
    if (!company) {
      throw new AppException(
        ErrorCode.ValidationError,
        'companyId does not reference an active company',
      );
    }

    const existing = await this.componentRepository.findOne({
      where: [
        { companyId, name: dto.name },
        { companyId, code: dto.code },
      ],
    });
    if (existing) {
      throw new AppException(
        ErrorCode.Conflict,
        'Payroll component name or code already exists for this company',
      );
    }

    this.assertCalculationFieldsMatch(
      dto.calculationType,
      dto.fixedAmount,
      dto.percentage,
    );

    const entity = this.componentRepository.create({
      companyId,
      name: dto.name,
      code: dto.code,
      type: dto.type,
      calculationType: dto.calculationType,
      fixedAmount:
        dto.calculationType === PayrollCalculationType.FixedAmount
          ? dto.fixedAmount!
          : null,
      percentage:
        dto.calculationType === PayrollCalculationType.PercentageOfBase
          ? dto.percentage!
          : null,
      isTaxable: dto.isTaxable ?? false,
      isActive: true,
      createdBy: userId,
      updatedBy: userId,
    });
    return this.componentRepository.save(entity);
  }

  async update(
    id: string,
    companyId: string,
    userId: string,
    dto: UpdatePayrollComponentDto,
  ): Promise<PayrollComponent> {
    const entity = await this.findByIdInCompany(id, companyId);

    if (dto.name !== undefined) {
      const existing = await this.componentRepository
        .createQueryBuilder('component')
        .where('component.companyId = :companyId', { companyId })
        .andWhere('component.name = :name', { name: dto.name })
        .andWhere('component.id != :id', { id })
        .getOne();
      if (existing) {
        throw new AppException(
          ErrorCode.Conflict,
          'Payroll component name already exists for this company',
        );
      }
      entity.name = dto.name;
    }

    if (dto.fixedAmount !== undefined || dto.percentage !== undefined) {
      const nextFixedAmount =
        dto.fixedAmount ?? entity.fixedAmount ?? undefined;
      const nextPercentage = dto.percentage ?? entity.percentage ?? undefined;
      this.assertCalculationFieldsMatch(
        entity.calculationType,
        nextFixedAmount,
        nextPercentage,
      );
      if (entity.calculationType === PayrollCalculationType.FixedAmount) {
        entity.fixedAmount = nextFixedAmount ?? null;
      } else {
        entity.percentage = nextPercentage ?? null;
      }
    }

    if (dto.isTaxable !== undefined) entity.isTaxable = dto.isTaxable;
    if (dto.isActive !== undefined) entity.isActive = dto.isActive;
    entity.updatedBy = userId;

    return this.componentRepository.save(entity);
  }

  async activate(
    id: string,
    companyId: string,
    userId: string,
  ): Promise<PayrollComponent> {
    const entity = await this.findByIdInCompany(id, companyId);
    entity.isActive = true;
    entity.updatedBy = userId;
    return this.componentRepository.save(entity);
  }

  async deactivate(
    id: string,
    companyId: string,
    userId: string,
  ): Promise<PayrollComponent> {
    const entity = await this.findByIdInCompany(id, companyId);
    entity.isActive = false;
    entity.updatedBy = userId;
    return this.componentRepository.save(entity);
  }

  async remove(id: string, companyId: string): Promise<void> {
    const entity = await this.findByIdInCompany(id, companyId);
    const { assignmentCount, historyCount } = await this.getUsageSummary(id);
    if (assignmentCount > 0 || historyCount > 0) {
      throw new AppException(
        ErrorCode.Conflict,
        'Payroll component is referenced by employee assignments or payroll history and cannot be deleted',
      );
    }
    await this.componentRepository.softRemove(entity);
  }

  async getUsageSummary(id: string): Promise<PayrollComponentUsageDto> {
    const [assignmentCount, historyCount] = await Promise.all([
      this.employeeComponentRepository.count({
        where: { payrollComponentId: id },
      }),
      this.runItemRepository.count({ where: { payrollComponentId: id } }),
    ]);

    return {
      assignmentCount,
      historyCount,
      canDelete: assignmentCount === 0 && historyCount === 0,
    };
  }

  async getUsageSummaries(
    ids: string[],
  ): Promise<Map<string, PayrollComponentUsageDto>> {
    const result = new Map<string, PayrollComponentUsageDto>();

    await Promise.all(
      ids.map(async (id) => {
        result.set(id, await this.getUsageSummary(id));
      }),
    );

    return result;
  }

  private assertCalculationFieldsMatch(
    calculationType: PayrollCalculationType,
    fixedAmount: string | undefined,
    percentage: string | undefined,
  ): void {
    if (calculationType === PayrollCalculationType.FixedAmount) {
      if (!fixedAmount) {
        throw new AppException(
          ErrorCode.ValidationError,
          'fixedAmount is required when calculationType is FIXED_AMOUNT',
        );
      }
      if (percentage) {
        throw new AppException(
          ErrorCode.ValidationError,
          'percentage must not be set when calculationType is FIXED_AMOUNT',
        );
      }
    } else {
      if (!percentage) {
        throw new AppException(
          ErrorCode.ValidationError,
          'percentage is required when calculationType is PERCENTAGE_OF_BASE',
        );
      }
      if (fixedAmount) {
        throw new AppException(
          ErrorCode.ValidationError,
          'fixedAmount must not be set when calculationType is PERCENTAGE_OF_BASE',
        );
      }
    }
  }
}
