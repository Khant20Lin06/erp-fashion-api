import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../entities/company.entity';
import { CompanyStatus } from '../entities/company-status.enum';
import { Branch } from '../entities/branch.entity';
import { CreateCompanyDto } from '../dto/create-company.dto';
import { UpdateCompanyDto } from '../dto/update-company.dto';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  PaginationDto,
} from '../../../shared/dto/pagination.dto';
import { resolveSortField } from '../../../shared/dto/resolve-sort-field';

export interface PaginatedCompanies {
  data: Company[];
  meta: { page: number; limit: number; total: number };
}

const SORTABLE_FIELDS = ['createdAt', 'name', 'code', 'status'] as const;

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
  ) {}

  async findAll(pagination: PaginationDto): Promise<PaginatedCompanies> {
    const page = pagination.page ?? DEFAULT_PAGE;
    const limit = pagination.limit ?? DEFAULT_LIMIT;
    const sortField = resolveSortField(
      pagination.sort,
      SORTABLE_FIELDS,
      'createdAt',
    );

    const [data, total] = await this.companyRepository.findAndCount({
      order: { [sortField]: pagination.order ?? 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, meta: { page, limit, total } };
  }

  async findById(id: string): Promise<Company> {
    const company = await this.companyRepository.findOne({ where: { id } });
    if (!company) {
      throw new AppException(ErrorCode.NotFound, 'Company not found');
    }
    return company;
  }

  /**
   * Loads a Company for another service's parent-validation use (e.g.
   * BranchesService checking a companyId before creating a Branch). Returns
   * null instead of throwing so the caller can produce a validation-scoped
   * error message rather than a generic "not found".
   */
  async findActiveByIdOrNull(id: string): Promise<Company | null> {
    return this.companyRepository.findOne({
      where: { id, status: CompanyStatus.Active },
    });
  }

  async create(dto: CreateCompanyDto): Promise<Company> {
    const existing = await this.companyRepository.findOne({
      where: { code: dto.code },
    });
    if (existing) {
      throw new AppException(ErrorCode.Conflict, 'Company code already exists');
    }

    const company = this.companyRepository.create({
      code: dto.code,
      name: dto.name,
      status: dto.status ?? CompanyStatus.Active,
      baseCurrency: dto.baseCurrency,
      timezone: dto.timezone,
      country: dto.country ?? null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      address: dto.address ?? null,
    });

    return this.companyRepository.save(company);
  }

  async update(id: string, dto: UpdateCompanyDto): Promise<Company> {
    const company = await this.findById(id);

    if (dto.name !== undefined) company.name = dto.name;
    if (dto.baseCurrency !== undefined) company.baseCurrency = dto.baseCurrency;
    if (dto.timezone !== undefined) company.timezone = dto.timezone;
    if (dto.country !== undefined) company.country = dto.country;
    if (dto.phone !== undefined) company.phone = dto.phone;
    if (dto.email !== undefined) company.email = dto.email;
    if (dto.address !== undefined) company.address = dto.address;

    return this.companyRepository.save(company);
  }

  async activate(id: string): Promise<Company> {
    const company = await this.findById(id);
    company.status = CompanyStatus.Active;
    return this.companyRepository.save(company);
  }

  async deactivate(id: string): Promise<Company> {
    const company = await this.findById(id);
    company.status = CompanyStatus.Inactive;
    return this.companyRepository.save(company);
  }

  /**
   * Soft delete only (Phase 07 §7, §31) — a Company with existing Branch
   * rows must never be deleted, since that would orphan its children. The
   * FK `ON DELETE RESTRICT` on branches.company_id is the hard backstop;
   * this explicit check gives the caller a clear 409 instead of a raw DB
   * constraint error.
   */
  async remove(id: string): Promise<void> {
    const company = await this.findById(id);

    const branchCount = await this.branchRepository.count({
      where: { companyId: id },
    });
    if (branchCount > 0) {
      throw new AppException(
        ErrorCode.Conflict,
        'Company has existing branches and cannot be deleted',
      );
    }

    await this.companyRepository.softRemove(company);
  }
}
