import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Account } from '../entities/account.entity';
import { CreateAccountDto } from '../dto/create-account.dto';
import { UpdateAccountDto } from '../dto/update-account.dto';
import { ListAccountsDto } from '../dto/list-accounts.dto';
import { CompaniesService } from '../../organization/services/companies.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { resolveSortField } from '../../../shared/dto/resolve-sort-field';

export interface PaginatedAccounts {
  data: Account[];
  meta: { page: number; limit: number; total: number };
}

const SORTABLE_FIELDS = ['createdAt', 'name', 'code', 'accountType'] as const;

/**
 * Chart of Accounts (D4, LOCKED). Self-referencing hierarchy with cycle
 * protection — a direct structural mirror of Phase 09's CategoriesService
 * (assertNoCycle() walks the ancestor chain of the proposed new parent,
 * bounded by the company's total account count). Company-scoped, resolved
 * the same way as every other company-scoped entity — no dedicated
 * AccountScopeService.
 *
 * No remove()/delete method exists at all (D4: "no delete if referenced by
 * any posted journal line — prefer deactivation") — the API surface (D22)
 * never lists a DELETE endpoint for /accounts in the first place, so this
 * service does not even expose the method Category's own remove() has.
 * update() only supports isActive/name/parentId — accountType/code are
 * immutable after creation.
 */
@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    private readonly companiesService: CompaniesService,
  ) {}

  async findAll(
    companyId: string,
    query: ListAccountsDto,
  ): Promise<PaginatedAccounts> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const sortField = resolveSortField(query.sort, SORTABLE_FIELDS, 'code');

    const qb = this.accountRepository
      .createQueryBuilder('account')
      .where('account.companyId = :companyId', { companyId });

    if (query.parentId) {
      qb.andWhere('account.parentId = :parentId', {
        parentId: query.parentId,
      });
    }
    if (query.accountType) {
      qb.andWhere('account.accountType = :accountType', {
        accountType: query.accountType,
      });
    }
    if (query.isActive !== undefined) {
      qb.andWhere('account.isActive = :isActive', {
        isActive: query.isActive === 'true',
      });
    }
    if (query.search) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('account.name LIKE :search', {
              search: `%${query.search}%`,
            })
            .orWhere('account.code LIKE :search', {
              search: `%${query.search}%`,
            });
        }),
      );
    }

    qb.orderBy(`account.${sortField}`, query.order ?? 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { page, limit, total } };
  }

  /** Company-scoped lookup — a cross-company id is treated as not found (404), never leaked. */
  async findByIdInCompany(id: string, companyId: string): Promise<Account> {
    const account = await this.accountRepository.findOne({
      where: { id, companyId },
    });
    if (!account) {
      throw new AppException(ErrorCode.NotFound, 'Account not found');
    }
    return account;
  }

  /**
   * Internal helper for AccountingPostingService/JournalEntriesService:
   * resolves an account by id + company, additionally requiring it to be
   * active. Returns null (never throws) so callers can decide the exact
   * fail-closed business-rule error message for their own context (D6's
   * "required accounting account mapping does not exist" case).
   */
  async findActiveByIdInCompanyOrNull(
    id: string,
    companyId: string,
  ): Promise<Account | null> {
    return this.accountRepository.findOne({
      where: { id, companyId, isActive: true },
    });
  }

  async create(companyId: string, dto: CreateAccountDto): Promise<Account> {
    const company = await this.companiesService.findActiveByIdOrNull(companyId);
    if (!company) {
      throw new AppException(
        ErrorCode.ValidationError,
        'companyId does not reference an active company',
      );
    }

    if (dto.parentId) {
      await this.assertValidParent(dto.parentId, companyId);
    }

    const existing = await this.accountRepository.findOne({
      where: { companyId, code: dto.code },
    });
    if (existing) {
      throw new AppException(
        ErrorCode.Conflict,
        'Account code already exists for this company',
      );
    }

    const account = this.accountRepository.create({
      companyId,
      code: dto.code,
      name: dto.name,
      accountType: dto.accountType,
      parentId: dto.parentId ?? null,
      isActive: true,
      isSystemAccount: false,
    });

    return this.accountRepository.save(account);
  }

  async update(
    id: string,
    companyId: string,
    dto: UpdateAccountDto,
  ): Promise<Account> {
    const account = await this.findByIdInCompany(id, companyId);

    if (dto.parentId !== undefined) {
      if (dto.parentId === id) {
        throw new AppException(
          ErrorCode.ValidationError,
          'Account cannot be its own parent',
        );
      }
      if (dto.parentId) {
        await this.assertValidParent(dto.parentId, companyId);
        await this.assertNoCycle(id, dto.parentId, companyId);
      }
      account.parentId = dto.parentId ?? null;
    }

    if (dto.name !== undefined) account.name = dto.name;
    if (dto.isActive !== undefined) account.isActive = dto.isActive;

    return this.accountRepository.save(account);
  }

  /** Parent must exist and belong to the same company (cross-company parent rejected, D4). */
  private async assertValidParent(
    parentId: string,
    companyId: string,
  ): Promise<void> {
    const parent = await this.accountRepository.findOne({
      where: { id: parentId, companyId },
    });
    if (!parent) {
      throw new AppException(
        ErrorCode.ValidationError,
        'parentId does not reference an account in this company',
      );
    }
  }

  /**
   * Walks the ancestor chain of the proposed new parent to ensure the
   * account being updated does not appear in it — rejects A->B->C->A style
   * cycles (D4, LOCKED), a direct mirror of CategoriesService's own
   * assertNoCycle().
   */
  private async assertNoCycle(
    accountId: string,
    newParentId: string,
    companyId: string,
  ): Promise<void> {
    let currentId: string | null = newParentId;
    const maxDepth = await this.accountRepository.count({
      where: { companyId },
    });
    let steps = 0;

    while (currentId) {
      if (currentId === accountId) {
        throw new AppException(
          ErrorCode.ValidationError,
          'This parent assignment would create a circular account hierarchy',
        );
      }

      steps += 1;
      if (steps > maxDepth) {
        throw new AppException(
          ErrorCode.ValidationError,
          'This parent assignment would create a circular account hierarchy',
        );
      }

      const current: Pick<Account, 'parentId'> | null =
        await this.accountRepository.findOne({
          where: { id: currentId },
          select: ['parentId'],
        });
      currentId = current?.parentId ?? null;
    }
  }
}
