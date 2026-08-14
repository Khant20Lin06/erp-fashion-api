import { Repository, SelectQueryBuilder } from 'typeorm';
import { AccountsService } from './accounts.service';
import { Account } from '../entities/account.entity';
import { AccountType } from '../entities/account-type.enum';
import { CompaniesService } from '../../organization/services/companies.service';
import { Company } from '../../organization/entities/company.entity';
import { CompanyStatus } from '../../organization/entities/company-status.enum';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('AccountsService', () => {
  let service: AccountsService;
  let accountRepository: jest.Mocked<
    Pick<
      Repository<Account>,
      'findOne' | 'create' | 'save' | 'count' | 'createQueryBuilder'
    >
  >;
  let companiesService: jest.Mocked<
    Pick<CompaniesService, 'findActiveByIdOrNull'>
  >;
  let queryBuilder: jest.Mocked<
    Pick<
      SelectQueryBuilder<Account>,
      'where' | 'andWhere' | 'orderBy' | 'skip' | 'take' | 'getManyAndCount'
    >
  >;

  const buildCompany = (overrides: Partial<Company> = {}): Company =>
    ({
      id: 'company-a',
      status: CompanyStatus.Active,
      ...overrides,
    }) as Company;

  const buildAccount = (overrides: Partial<Account> = {}): Account =>
    ({
      id: 'account-1',
      companyId: 'company-a',
      code: 'CASH',
      name: 'Cash',
      accountType: AccountType.Asset,
      parentId: null,
      isActive: true,
      isSystemAccount: false,
      ...overrides,
    }) as Account;

  beforeEach(() => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };
    accountRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    companiesService = { findActiveByIdOrNull: jest.fn() };

    service = new AccountsService(
      accountRepository as unknown as Repository<Account>,
      companiesService as unknown as CompaniesService,
    );
  });

  describe('create', () => {
    it('creates a top-level account when company is active and code is unique', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      accountRepository.findOne.mockResolvedValue(null);
      const created = buildAccount();
      accountRepository.create.mockReturnValue(created);
      accountRepository.save.mockResolvedValue(created);

      const result = await service.create('company-a', {
        code: 'CASH',
        name: 'Cash',
        accountType: AccountType.Asset,
      });

      expect(result).toBe(created);
    });

    it('rejects when companyId does not reference an active company', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(null);

      await expect(
        service.create('missing', {
          code: 'X',
          name: 'X',
          accountType: AccountType.Asset,
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects a cross-company parentId', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      // assertValidParent looks up { id: parentId, companyId } — a
      // cross-company parent never matches, so findOne resolves null.
      accountRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create('company-a', {
          code: 'CASH',
          name: 'Cash',
          accountType: AccountType.Asset,
          parentId: 'parent-in-company-b',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects a duplicate code within the same company (409)', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      accountRepository.findOne.mockResolvedValue(buildAccount());

      await expect(
        service.create('company-a', {
          code: 'CASH',
          name: 'Duplicate',
          accountType: AccountType.Asset,
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });
  });

  describe('update — self-parent and cycle protection (D4, LOCKED)', () => {
    it('rejects assigning an account as its own parent', async () => {
      accountRepository.findOne.mockResolvedValue(
        buildAccount({ id: 'account-1' }),
      );

      await expect(
        service.update('account-1', 'company-a', { parentId: 'account-1' }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects A -> B -> C -> A style circular hierarchy', async () => {
      const accountA = buildAccount({ id: 'account-a', parentId: null });

      accountRepository.findOne
        .mockImplementationOnce(() => Promise.resolve(accountA)) // findByIdInCompany(A)
        .mockImplementationOnce(() =>
          Promise.resolve(
            buildAccount({ id: 'account-c', parentId: 'account-b' }),
          ),
        ) // assertValidParent(C)
        .mockImplementationOnce(() =>
          Promise.resolve({ parentId: 'account-b' } as Account),
        ) // C.parentId = B
        .mockImplementationOnce(() =>
          Promise.resolve({ parentId: 'account-a' } as Account),
        ); // B.parentId = A -> matches categoryId (A) -> cycle detected

      accountRepository.count.mockResolvedValue(3);

      await expect(
        service.update('account-a', 'company-a', { parentId: 'account-c' }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('allows a valid non-circular reparenting', async () => {
      const accountC = buildAccount({ id: 'account-c', parentId: 'account-b' });

      accountRepository.findOne
        .mockImplementationOnce(() => Promise.resolve(accountC)) // findByIdInCompany(C)
        .mockImplementationOnce(() =>
          Promise.resolve(buildAccount({ id: 'account-a', parentId: null })),
        ) // assertValidParent(A)
        .mockImplementationOnce(() =>
          Promise.resolve({ parentId: null } as Account),
        ); // A.parentId = null -> loop ends, no cycle

      accountRepository.count.mockResolvedValue(3);
      accountRepository.save.mockImplementation((input) =>
        Promise.resolve(input as Account),
      );

      const result = await service.update('account-c', 'company-a', {
        parentId: 'account-a',
      });

      expect(result.parentId).toBe('account-a');
    });

    it('supports deactivating an account via isActive', async () => {
      const account = buildAccount({ isActive: true });
      accountRepository.findOne.mockResolvedValue(account);
      accountRepository.save.mockImplementation((input) =>
        Promise.resolve(input as Account),
      );

      const result = await service.update('account-1', 'company-a', {
        isActive: false,
      });

      expect(result.isActive).toBe(false);
    });
  });

  describe('findByIdInCompany — cross-company isolation (IDOR)', () => {
    it('throws NotFound (not Forbidden) for an account in a different company', async () => {
      accountRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findByIdInCompany('account-1', 'company-b'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
      expect(accountRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'account-1', companyId: 'company-b' },
      });
    });
  });

  describe('findActiveByIdInCompanyOrNull', () => {
    it('returns null (never throws) when not found', async () => {
      accountRepository.findOne.mockResolvedValue(null);

      const result = await service.findActiveByIdInCompanyOrNull(
        'missing',
        'company-a',
      );

      expect(result).toBeNull();
    });

    it('returns the account when found active in the same company', async () => {
      const account = buildAccount();
      accountRepository.findOne.mockResolvedValue(account);

      const result = await service.findActiveByIdInCompanyOrNull(
        'account-1',
        'company-a',
      );

      expect(result).toBe(account);
    });
  });
});
