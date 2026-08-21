import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Department } from '../entities/department.entity';
import {
  CreateDepartmentDto,
  ListDepartmentsDto,
  UpdateDepartmentDto,
} from '../dto/departments.dto';
import { CompaniesService } from '../../organization/services/companies.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { resolveSortField } from '../../../shared/dto/resolve-sort-field';
import { DepartmentStatus } from '../entities/department-status.enum';
import { InjectRepository as InjectAssignmentRepository } from '@nestjs/typeorm';
import { EmployeeAssignment } from '../entities/employee-assignment.entity';

const SORTABLE_FIELDS = ['createdAt', 'name', 'code', 'status'] as const;

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    @InjectAssignmentRepository(EmployeeAssignment)
    private readonly assignmentRepository: Repository<EmployeeAssignment>,
    private readonly companiesService: CompaniesService,
  ) {}

  async findAll(
    companyId: string,
    query: ListDepartmentsDto,
  ): Promise<{
    data: Department[];
    meta: { page: number; limit: number; total: number };
  }> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const sortField = resolveSortField(query.sort, SORTABLE_FIELDS, 'name');

    const qb = this.departmentRepository
      .createQueryBuilder('department')
      .where('department.companyId = :companyId', { companyId });

    if (query.status) {
      qb.andWhere('department.status = :status', { status: query.status });
    }
    if (query.search) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('department.name LIKE :search', {
              search: `%${query.search}%`,
            })
            .orWhere('department.code LIKE :search', {
              search: `%${query.search}%`,
            });
        }),
      );
    }

    qb.orderBy(`department.${sortField}`, query.order ?? 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { page, limit, total } };
  }

  async findByIdInCompany(id: string, companyId: string): Promise<Department> {
    const entity = await this.departmentRepository.findOne({
      where: { id, companyId },
    });
    if (!entity) {
      throw new AppException(ErrorCode.NotFound, 'Department not found');
    }
    return entity;
  }

  async create(
    companyId: string,
    dto: CreateDepartmentDto,
  ): Promise<Department> {
    const company = await this.companiesService.findActiveByIdOrNull(companyId);
    if (!company) {
      throw new AppException(
        ErrorCode.ValidationError,
        'companyId does not reference an active company',
      );
    }

    await this.assertUnique(companyId, dto.name, dto.code);

    const entity = this.departmentRepository.create({
      companyId,
      name: dto.name,
      code: dto.code ?? null,
      description: dto.description ?? null,
      status: DepartmentStatus.Active,
    });

    return this.departmentRepository.save(entity);
  }

  async update(
    id: string,
    companyId: string,
    dto: UpdateDepartmentDto,
  ): Promise<Department> {
    const entity = await this.findByIdInCompany(id, companyId);

    const nextName = dto.name ?? entity.name;
    const nextCode =
      dto.code === undefined ? entity.code : dto.code?.trim() || null;
    await this.assertUnique(companyId, nextName, nextCode, id);

    if (dto.name !== undefined) entity.name = dto.name;
    if (dto.code !== undefined) entity.code = dto.code?.trim() || null;
    if (dto.description !== undefined) {
      entity.description = dto.description?.trim() || null;
    }

    return this.departmentRepository.save(entity);
  }

  async activate(id: string, companyId: string): Promise<Department> {
    const entity = await this.findByIdInCompany(id, companyId);
    entity.status = DepartmentStatus.Active;
    return this.departmentRepository.save(entity);
  }

  async deactivate(id: string, companyId: string): Promise<Department> {
    const entity = await this.findByIdInCompany(id, companyId);
    entity.status = DepartmentStatus.Inactive;
    return this.departmentRepository.save(entity);
  }

  async remove(id: string, companyId: string): Promise<void> {
    const entity = await this.findByIdInCompany(id, companyId);
    const assignmentCount = await this.assignmentRepository.count({
      where: { departmentId: id },
    });
    if (assignmentCount > 0) {
      throw new AppException(
        ErrorCode.Conflict,
        'Department is referenced by employee assignments and cannot be deleted',
      );
    }
    await this.departmentRepository.softRemove(entity);
  }

  private async assertUnique(
    companyId: string,
    name: string,
    code?: string | null,
    ignoreId?: string,
  ): Promise<void> {
    const qb = this.departmentRepository
      .createQueryBuilder('department')
      .where('department.companyId = :companyId', { companyId })
      .andWhere('(department.name = :name OR department.code = :code)', {
        name,
        code: code ?? null,
      });

    if (ignoreId) {
      qb.andWhere('department.id != :ignoreId', { ignoreId });
    }

    const existing = await qb.getOne();
    if (existing) {
      throw new AppException(
        ErrorCode.Conflict,
        'Department name or code already exists for this company',
      );
    }
  }
}
