import { Repository, SelectQueryBuilder } from 'typeorm';
import { CategoriesService } from './categories.service';
import { Category } from '../entities/category.entity';
import { CategoryStatus } from '../entities/category-status.enum';
import { CompaniesService } from '../../organization/services/companies.service';
import { Company } from '../../organization/entities/company.entity';
import { CompanyStatus } from '../../organization/entities/company-status.enum';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let categoryRepository: jest.Mocked<
    Pick<
      Repository<Category>,
      | 'findOne'
      | 'create'
      | 'save'
      | 'softRemove'
      | 'count'
      | 'createQueryBuilder'
    >
  >;
  let companiesService: jest.Mocked<
    Pick<CompaniesService, 'findActiveByIdOrNull'>
  >;
  let queryBuilder: jest.Mocked<
    Pick<
      SelectQueryBuilder<Category>,
      'where' | 'andWhere' | 'orderBy' | 'skip' | 'take' | 'getManyAndCount'
    >
  >;

  const buildCompany = (overrides: Partial<Company> = {}): Company =>
    ({
      id: 'company-a',
      status: CompanyStatus.Active,
      ...overrides,
    }) as Company;

  const buildCategory = (overrides: Partial<Category> = {}): Category =>
    ({
      id: 'category-1',
      companyId: 'company-a',
      code: 'CAT-MEN',
      name: 'Men',
      description: null,
      parentId: null,
      status: CategoryStatus.Active,
      sortOrder: 0,
      ...overrides,
    }) as Category;

  beforeEach(() => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };
    categoryRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softRemove: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    companiesService = { findActiveByIdOrNull: jest.fn() };

    service = new CategoriesService(
      categoryRepository as unknown as Repository<Category>,
      companiesService as unknown as CompaniesService,
    );
  });

  describe('create', () => {
    it('creates a top-level category when company is active and code is unique', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      categoryRepository.findOne.mockResolvedValue(null);
      const created = buildCategory();
      categoryRepository.create.mockReturnValue(created);
      categoryRepository.save.mockResolvedValue(created);

      const result = await service.create('company-a', {
        code: 'CAT-MEN',
        name: 'Men',
      });

      expect(result).toBe(created);
    });

    it('creates a subcategory when parentId references a valid active parent in the same company', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      categoryRepository.findOne
        .mockResolvedValueOnce(buildCategory({ id: 'parent-1' })) // parent validity check
        .mockResolvedValueOnce(null); // duplicate-code check
      const created = buildCategory({ id: 'category-2', parentId: 'parent-1' });
      categoryRepository.create.mockReturnValue(created);
      categoryRepository.save.mockResolvedValue(created);

      const result = await service.create('company-a', {
        code: 'CAT-SHIRTS',
        name: 'Shirts',
        parentId: 'parent-1',
      });

      expect(result.parentId).toBe('parent-1');
    });

    it('rejects when companyId does not reference an active company', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(null);

      await expect(
        service.create('missing', { code: 'CAT-X', name: 'X' }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects when parentId does not reference an active category in the same company', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      categoryRepository.findOne.mockResolvedValue(null); // parent lookup fails

      await expect(
        service.create('company-a', {
          code: 'CAT-X',
          name: 'X',
          parentId: 'missing-parent',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects a duplicate code within the same company (409)', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      categoryRepository.findOne.mockResolvedValue(buildCategory());

      await expect(
        service.create('company-a', { code: 'CAT-MEN', name: 'Duplicate' }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });
  });

  describe('update — self-parent and cycle protection (LOCKED §4)', () => {
    it('rejects assigning a category as its own parent', async () => {
      categoryRepository.findOne.mockResolvedValue(
        buildCategory({ id: 'category-1' }),
      );

      await expect(
        service.update('category-1', 'company-a', { parentId: 'category-1' }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects A -> B -> C -> A style circular hierarchy', async () => {
      // category-1 = A, category-2 = B, category-3 = C
      // Existing chain: B.parentId = A, C.parentId = B
      // Attempt: A.parentId = C  => cycle A -> C -> B -> A
      const categoryA = buildCategory({ id: 'category-a', parentId: null });

      categoryRepository.findOne
        .mockImplementationOnce(() => Promise.resolve(categoryA)) // findByIdInCompany(A)
        .mockImplementationOnce(() =>
          Promise.resolve(
            buildCategory({ id: 'category-c', parentId: 'category-b' }),
          ),
        ) // assertValidParent(C) - active parent check
        // assertNoCycle walk: start at newParentId = C
        .mockImplementationOnce(() =>
          Promise.resolve({ parentId: 'category-b' } as Category),
        ) // C.parentId = B
        .mockImplementationOnce(() =>
          Promise.resolve({ parentId: 'category-a' } as Category),
        ); // B.parentId = A -> matches categoryId (A) -> cycle detected

      categoryRepository.count.mockResolvedValue(3);

      await expect(
        service.update('category-a', 'company-a', { parentId: 'category-c' }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('allows a valid non-circular reparenting (A -> B -> C, reparent C under A)', async () => {
      const categoryC = buildCategory({
        id: 'category-c',
        parentId: 'category-b',
      });

      categoryRepository.findOne
        .mockImplementationOnce(() => Promise.resolve(categoryC)) // findByIdInCompany(C)
        .mockImplementationOnce(() =>
          Promise.resolve(buildCategory({ id: 'category-a', parentId: null })),
        ) // assertValidParent(A)
        // assertNoCycle walk from newParentId = A: A.parentId = null -> loop ends, no cycle
        .mockImplementationOnce(() =>
          Promise.resolve({ parentId: null } as Category),
        );

      categoryRepository.count.mockResolvedValue(3);
      categoryRepository.save.mockImplementation((input) =>
        Promise.resolve(input as Category),
      );

      const result = await service.update('category-c', 'company-a', {
        parentId: 'category-a',
      });

      expect(result.parentId).toBe('category-a');
    });
  });

  describe('remove', () => {
    it('rejects deletion when child categories exist (no orphaning, §25)', async () => {
      categoryRepository.findOne.mockResolvedValue(buildCategory());
      categoryRepository.count.mockResolvedValue(1);

      await expect(
        service.remove('category-1', 'company-a'),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.Conflict,
      });
      expect(categoryRepository.softRemove).not.toHaveBeenCalled();
    });

    it('soft-deletes a category with no children', async () => {
      const category = buildCategory();
      categoryRepository.findOne.mockResolvedValue(category);
      categoryRepository.count.mockResolvedValue(0);

      await service.remove('category-1', 'company-a');

      expect(categoryRepository.softRemove).toHaveBeenCalledWith(category);
    });
  });

  describe('findByIdInCompany — cross-company isolation (IDOR)', () => {
    it('throws NotFound (not Forbidden) for a category in a different company', async () => {
      categoryRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findByIdInCompany('category-1', 'company-b'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
      expect(categoryRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'category-1', companyId: 'company-b' },
      });
    });
  });
});
