import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Category } from '../entities/category.entity';
import { CategoryStatus } from '../entities/category-status.enum';
import { Product } from '../../products/entities/product.entity';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { ListCategoriesDto } from '../dto/list-categories.dto';
import { CompaniesService } from '../../organization/services/companies.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { resolveSortField } from '../../../shared/dto/resolve-sort-field';

export type CategoryListItem = Category & { productCount: number };

export interface PaginatedCategories {
  data: CategoryListItem[];
  meta: { page: number; limit: number; total: number };
}

const SORTABLE_FIELDS = [
  'createdAt',
  'name',
  'code',
  'status',
  'sortOrder',
] as const;

/**
 * Self-referencing hierarchy with cycle protection (Phase 09 §4, LOCKED).
 * Company-scoped, resolved the same way as every other master-data entity
 * — no dedicated CategoryScopeService (§3, LOCKED).
 */
@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly companiesService: CompaniesService,
  ) {}

  async findAll(
    companyId: string,
    query: ListCategoriesDto,
  ): Promise<PaginatedCategories> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const sortField = resolveSortField(
      query.sort,
      SORTABLE_FIELDS,
      'sortOrder',
    );

    const qb = this.categoryRepository
      .createQueryBuilder('category')
      .where('category.companyId = :companyId', { companyId });

    if (query.parentId) {
      qb.andWhere('category.parentId = :parentId', {
        parentId: query.parentId,
      });
    }
    if (query.status) {
      qb.andWhere('category.status = :status', { status: query.status });
    }
    if (query.search) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('category.name LIKE :search', {
              search: `%${query.search}%`,
            })
            .orWhere('category.code LIKE :search', {
              search: `%${query.search}%`,
            });
        }),
      );
    }

    qb.orderBy(`category.${sortField}`, query.order ?? 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    const categoriesWithCounts = await Promise.all(
      data.map(async (category) =>
        Object.assign(category, {
          productCount: await this.productRepository.count({
            where: { companyId, categoryId: category.id },
          }),
        }),
      ),
    );

    return { data: categoriesWithCounts, meta: { page, limit, total } };
  }

  /**
   * Company-scoped lookup — a category from another company is treated as
   * not found (Phase 09 §18, IDOR protection), never leaked as a 403.
   */
  async findByIdInCompany(id: string, companyId: string): Promise<Category> {
    const category = await this.categoryRepository.findOne({
      where: { id, companyId },
    });
    if (!category) {
      throw new AppException(ErrorCode.NotFound, 'Category not found');
    }
    return category;
  }

  async create(companyId: string, dto: CreateCategoryDto): Promise<Category> {
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

    const code = await this.resolveCreateCode(companyId, dto.code, dto.name);

    const category = this.categoryRepository.create({
      companyId,
      code,
      name: dto.name,
      description: dto.description ?? null,
      parentId: dto.parentId ?? null,
      status: CategoryStatus.Active,
      sortOrder: dto.sortOrder ?? 0,
    });

    return this.categoryRepository.save(category);
  }

  async update(
    id: string,
    companyId: string,
    dto: UpdateCategoryDto,
  ): Promise<Category> {
    const category = await this.findByIdInCompany(id, companyId);

    if (dto.parentId !== undefined) {
      if (dto.parentId === id) {
        throw new AppException(
          ErrorCode.ValidationError,
          'Category cannot be its own parent',
        );
      }
      if (dto.parentId) {
        await this.assertValidParent(dto.parentId, companyId);
        await this.assertNoCycle(id, dto.parentId, companyId);
      }
      category.parentId = dto.parentId ?? null;
    }

    if (dto.name !== undefined) category.name = dto.name;
    if (dto.description !== undefined) category.description = dto.description;
    if (dto.sortOrder !== undefined) category.sortOrder = dto.sortOrder;

    return this.categoryRepository.save(category);
  }

  async activate(id: string, companyId: string): Promise<Category> {
    const category = await this.findByIdInCompany(id, companyId);
    category.status = CategoryStatus.Active;
    return this.categoryRepository.save(category);
  }

  async deactivate(id: string, companyId: string): Promise<Category> {
    const category = await this.findByIdInCompany(id, companyId);
    category.status = CategoryStatus.Inactive;
    return this.categoryRepository.save(category);
  }

  /**
   * Soft delete only, blocked while active children exist (Phase 09 §25) —
   * mirrors the child-check pattern already established for Company/Branch
   * in Phase 07.
   */
  async remove(id: string, companyId: string): Promise<void> {
    const category = await this.findByIdInCompany(id, companyId);

    const childCount = await this.categoryRepository.count({
      where: { parentId: id },
    });
    if (childCount > 0) {
      throw new AppException(
        ErrorCode.Conflict,
        'Category has child categories and cannot be deleted',
      );
    }

    const productCount = await this.productRepository.count({
      where: { companyId, categoryId: id },
    });
    if (productCount > 0) {
      throw new AppException(
        ErrorCode.Conflict,
        `This category cannot be deleted because ${productCount} product${
          productCount === 1 ? ' is' : 's are'
        } assigned to it. Move or delete ${
          productCount === 1 ? 'that product' : 'those products'
        } first.`,
      );
    }

    await this.categoryRepository.softRemove(category);
  }

  private async resolveCreateCode(
    companyId: string,
    requestedCode: string | undefined,
    name: string,
  ): Promise<string> {
    const normalizedRequestedCode = requestedCode?.trim();
    if (normalizedRequestedCode) {
      const existing = await this.categoryRepository.findOne({
        where: { companyId, code: normalizedRequestedCode },
      });
      if (existing) {
        throw new AppException(
          ErrorCode.Conflict,
          'Category code already exists for this company',
        );
      }
      return normalizedRequestedCode;
    }

    return this.generateUniqueCode(companyId, name);
  }

  private async generateUniqueCode(
    companyId: string,
    name: string,
  ): Promise<string> {
    const baseCode = this.buildBaseCode(name);
    let candidate = baseCode;
    let suffix = 2;

    while (
      await this.categoryRepository.findOne({
        where: { companyId, code: candidate },
      })
    ) {
      candidate = this.appendNumericSuffix(baseCode, suffix);
      suffix += 1;
    }

    return candidate;
  }

  private buildBaseCode(name: string): string {
    const slug =
      name
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'ITEM';

    return this.truncateCode(`CAT-${slug}`);
  }

  private appendNumericSuffix(baseCode: string, suffix: number): string {
    const suffixText = `-${suffix}`;
    const maxBaseLength = 50 - suffixText.length;
    const truncatedBase = baseCode.slice(0, maxBaseLength).replace(/-+$/g, '');
    return `${truncatedBase}${suffixText}`;
  }

  private truncateCode(code: string): string {
    const truncated = code.slice(0, 50).replace(/-+$/g, '');
    return truncated || 'CAT-ITEM';
  }

  /**
   * Parent must exist, be active, and belong to the same company (Phase 09
   * §4, §64). Never trusts a client-supplied parentId beyond using it as a
   * lookup key.
   */
  private async assertValidParent(
    parentId: string,
    companyId: string,
  ): Promise<void> {
    const parent = await this.categoryRepository.findOne({
      where: { id: parentId, companyId, status: CategoryStatus.Active },
    });
    if (!parent) {
      throw new AppException(
        ErrorCode.ValidationError,
        'parentId does not reference an active category in this company',
      );
    }
  }

  /**
   * Walks the ancestor chain of the proposed new parent to ensure the
   * category being updated does not appear in it — rejects A→B→C→A style
   * cycles (Phase 09 §4, §24, LOCKED). Bounded by the total category count
   * in the company so a corrupted chain cannot loop forever.
   */
  private async assertNoCycle(
    categoryId: string,
    newParentId: string,
    companyId: string,
  ): Promise<void> {
    let currentId: string | null = newParentId;
    const maxDepth = await this.categoryRepository.count({
      where: { companyId },
    });
    let steps = 0;

    while (currentId) {
      if (currentId === categoryId) {
        throw new AppException(
          ErrorCode.ValidationError,
          'This parent assignment would create a circular category hierarchy',
        );
      }

      steps += 1;
      if (steps > maxDepth) {
        throw new AppException(
          ErrorCode.ValidationError,
          'This parent assignment would create a circular category hierarchy',
        );
      }

      const current: Pick<Category, 'parentId'> | null =
        await this.categoryRepository.findOne({
          where: { id: currentId },
          select: ['parentId'],
        });
      currentId = current?.parentId ?? null;
    }
  }
}
