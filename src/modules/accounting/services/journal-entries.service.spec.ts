import { EntityManager, Repository } from 'typeorm';
import { JournalEntriesService } from './journal-entries.service';
import { JournalEntry } from '../entities/journal-entry.entity';
import { JournalEntryStatus } from '../entities/journal-entry-status.enum';
import { JournalSourceType } from '../entities/journal-source-type.enum';
import { Account } from '../entities/account.entity';
import { AccountType } from '../entities/account-type.enum';
import { AccountingPeriodStatus } from '../entities/accounting-period-status.enum';
import { FiscalYearStatus } from '../entities/fiscal-year-status.enum';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { CompaniesService } from '../../organization/services/companies.service';
import { CompanyStatus } from '../../organization/entities/company-status.enum';
import { BranchesService } from '../../organization/services/branches.service';
import { AccountingPeriodResolverService } from './accounting-period-resolver.service';
import { ErrorCode } from '../../../core/errors/error-codes';
import { CreateJournalEntryDto } from '../dto/create-journal-entry.dto';

describe('JournalEntriesService', () => {
  let service: JournalEntriesService;
  let journalEntryRepository: jest.Mocked<
    Pick<Repository<JournalEntry>, 'findOne' | 'createQueryBuilder'>
  >;
  let transactionService: jest.Mocked<Pick<TransactionService, 'run'>>;
  let companiesService: jest.Mocked<
    Pick<CompaniesService, 'findActiveByIdOrNull'>
  >;
  let branchesService: jest.Mocked<
    Pick<BranchesService, 'findActiveByIdOrNull'>
  >;
  let periodResolver: jest.Mocked<
    Pick<AccountingPeriodResolverService, 'resolveOpenPeriod'>
  >;

  let manager: {
    query: jest.Mock;
    createQueryBuilder: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
  };
  let counterQueryBuilder: {
    where: jest.Mock;
    andWhere: jest.Mock;
    setLock: jest.Mock;
    getOneOrFail: jest.Mock;
    getOne: jest.Mock;
  };

  const buildCompany = () =>
    ({ id: 'company-a', status: CompanyStatus.Active }) as never;
  const buildPeriod = (overrides: Record<string, unknown> = {}) => ({
    id: 'period-1',
    fiscalYearId: 'fy-1',
    status: AccountingPeriodStatus.Open,
    ...overrides,
  });
  const buildAccount = (overrides: Partial<Account> = {}): Account =>
    ({
      id: 'account-1',
      companyId: 'company-a',
      isActive: true,
      accountType: AccountType.Asset,
      ...overrides,
    }) as Account;

  const baseDto = (
    overrides: Partial<CreateJournalEntryDto> = {},
  ): CreateJournalEntryDto => ({
    description: 'Manual entry',
    lines: [
      { accountId: 'account-1', debitAmount: '100.00', creditAmount: '0.00' },
      { accountId: 'account-2', debitAmount: '0.00', creditAmount: '100.00' },
    ],
    ...overrides,
  });

  beforeEach(() => {
    journalEntryRepository = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    counterQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOneOrFail: jest
        .fn()
        .mockResolvedValue({ id: 'counter-1', lastSequence: 0 }),
      getOne: jest.fn().mockResolvedValue(null),
    };
    manager = {
      query: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockReturnValue(counterQueryBuilder),
      create: jest.fn((_entity, data: Record<string, unknown>) => data),
      save: jest.fn((_entity, data: Record<string, unknown>) =>
        Promise.resolve({ id: 'new-id', ...data }),
      ),
      update: jest.fn().mockResolvedValue(undefined),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockImplementation((entity: unknown) => {
        if (entity === Account) {
          return Promise.resolve(buildAccount());
        }
        return Promise.resolve(null);
      }),
      findOneOrFail: jest.fn(),
    };
    transactionService = {
      run: jest
        .fn()
        .mockImplementation((work: (m: EntityManager) => Promise<unknown>) =>
          work(manager as unknown as EntityManager),
        ),
    };
    companiesService = {
      findActiveByIdOrNull: jest.fn().mockResolvedValue(buildCompany()),
    };
    branchesService = { findActiveByIdOrNull: jest.fn() };
    periodResolver = {
      resolveOpenPeriod: jest.fn().mockResolvedValue(buildPeriod()),
    };

    service = new JournalEntriesService(
      journalEntryRepository as unknown as Repository<JournalEntry>,
      transactionService as unknown as TransactionService,
      companiesService as unknown as CompaniesService,
      branchesService as unknown as BranchesService,
      periodResolver,
    );
  });

  describe('create (DRAFT)', () => {
    it('creates a DRAFT journal entry with sourceType=MANUAL even when lines are unbalanced', async () => {
      const result = await service.create(
        'company-a',
        'user-1',
        baseDto({
          lines: [
            {
              accountId: 'account-1',
              debitAmount: '100.00',
              creditAmount: '0.00',
            },
            {
              accountId: 'account-2',
              debitAmount: '0.00',
              creditAmount: '50.00',
            },
          ],
        }),
      );

      expect(result.status).toBe(JournalEntryStatus.Draft);
      expect(result.sourceType).toBe(JournalSourceType.Manual);
    });

    it('rejects when companyId does not reference an active company', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(null);

      await expect(
        service.create('missing', 'user-1', baseDto()),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects when a line references a nonexistent/cross-company account', async () => {
      manager.findOne.mockResolvedValueOnce(null);

      await expect(
        service.create('company-a', 'user-1', baseDto()),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects when a line references an inactive account', async () => {
      manager.findOne.mockResolvedValueOnce(buildAccount({ isActive: false }));

      await expect(
        service.create('company-a', 'user-1', baseDto()),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });
  });

  describe('generateJournalNumber — numbering (mirrors CompanyPaymentCounter pattern)', () => {
    it('formats the journal number as JE-<year>-<6-digit sequence>', async () => {
      counterQueryBuilder.getOneOrFail.mockResolvedValue({
        id: 'counter-1',
        lastSequence: 4,
      });

      const number = await service.generateJournalNumber(
        'company-a',
        2026,
        manager as unknown as EntityManager,
      );

      expect(number).toBe('JE-2026-000005');
      expect(manager.update).toHaveBeenCalledWith(
        expect.anything(),
        'counter-1',
        { lastSequence: 5 },
      );
    });
  });

  describe('post — balance validation and lifecycle (D2/D3/D12)', () => {
    function mockDraftEntry(overrides: Record<string, unknown> = {}) {
      const entry = {
        id: 'je-1',
        companyId: 'company-a',
        status: JournalEntryStatus.Draft,
        accountingPeriodId: 'period-1',
        ...overrides,
      };
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(entry),
      };
      manager.createQueryBuilder = jest.fn().mockReturnValue(qb);
      return entry;
    }

    it('posts a balanced DRAFT journal, stamping postedBy/postedAt', async () => {
      mockDraftEntry();
      manager.find = jest.fn().mockResolvedValue([
        { accountId: 'a1', debitAmount: '100.00', creditAmount: '0.00' },
        { accountId: 'a2', debitAmount: '0.00', creditAmount: '100.00' },
      ]);
      manager.findOneOrFail = jest
        .fn()
        .mockImplementation((entity: unknown) => {
          if (entity === JournalEntry) {
            return Promise.resolve({
              id: 'je-1',
              status: JournalEntryStatus.Posted,
            });
          }
          if ((entity as { name?: string })?.name === 'AccountingPeriod') {
            return Promise.resolve({
              id: 'period-1',
              fiscalYearId: 'fy-1',
              status: AccountingPeriodStatus.Open,
            });
          }
          return Promise.resolve({
            id: 'fy-1',
            status: FiscalYearStatus.Open,
          });
        });

      const result = await service.post('je-1', 'company-a', 'user-1');

      expect(manager.update).toHaveBeenCalledWith(
        JournalEntry,
        'je-1',
        expect.objectContaining({
          status: JournalEntryStatus.Posted,
          totalDebit: '100.00',
          totalCredit: '100.00',
          postedBy: 'user-1',
        }),
      );
      expect(result.id).toBe('je-1');
    });

    it('rejects posting an unbalanced journal', async () => {
      mockDraftEntry();
      manager.find = jest.fn().mockResolvedValue([
        { accountId: 'a1', debitAmount: '100.00', creditAmount: '0.00' },
        { accountId: 'a2', debitAmount: '0.00', creditAmount: '50.00' },
      ]);

      await expect(
        service.post('je-1', 'company-a', 'user-1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('rejects posting a journal that is not DRAFT (already POSTED)', async () => {
      mockDraftEntry({ status: JournalEntryStatus.Posted });

      await expect(
        service.post('je-1', 'company-a', 'user-1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('rejects posting when not found (cross-company/nonexistent)', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      manager.createQueryBuilder = jest.fn().mockReturnValue(qb);

      await expect(
        service.post('je-1', 'company-b', 'user-1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });

    it('rejects posting into a LOCKED accounting period', async () => {
      mockDraftEntry();
      manager.find = jest.fn().mockResolvedValue([
        { accountId: 'a1', debitAmount: '100.00', creditAmount: '0.00' },
        { accountId: 'a2', debitAmount: '0.00', creditAmount: '100.00' },
      ]);
      manager.findOneOrFail = jest
        .fn()
        .mockImplementation((entity: unknown) => {
          if ((entity as { name?: string })?.name === 'AccountingPeriod') {
            return Promise.resolve({
              id: 'period-1',
              fiscalYearId: 'fy-1',
              status: AccountingPeriodStatus.Locked,
            });
          }
          return Promise.resolve({ id: 'fy-1', status: FiscalYearStatus.Open });
        });

      await expect(
        service.post('je-1', 'company-a', 'user-1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('rejects posting into a period whose fiscal year is CLOSED', async () => {
      mockDraftEntry();
      manager.find = jest.fn().mockResolvedValue([
        { accountId: 'a1', debitAmount: '100.00', creditAmount: '0.00' },
        { accountId: 'a2', debitAmount: '0.00', creditAmount: '100.00' },
      ]);
      manager.findOneOrFail = jest
        .fn()
        .mockImplementation((entity: unknown) => {
          if ((entity as { name?: string })?.name === 'AccountingPeriod') {
            return Promise.resolve({
              id: 'period-1',
              fiscalYearId: 'fy-1',
              status: AccountingPeriodStatus.Open,
            });
          }
          return Promise.resolve({
            id: 'fy-1',
            status: FiscalYearStatus.Closed,
          });
        });

      await expect(
        service.post('je-1', 'company-a', 'user-1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
      expect(manager.update).not.toHaveBeenCalled();
    });
  });

  describe('cancel — DRAFT -> CANCELLED only', () => {
    it('cancels a DRAFT journal entry', async () => {
      const entry = {
        id: 'je-1',
        companyId: 'company-a',
        status: JournalEntryStatus.Draft,
      };
      journalEntryRepository.findOne = jest.fn().mockResolvedValue(entry);
      (journalEntryRepository as unknown as { save: jest.Mock }).save = jest
        .fn()
        .mockImplementation((input) => Promise.resolve(input));

      const result = await service.cancel('je-1', 'company-a');

      expect(result.status).toBe(JournalEntryStatus.Cancelled);
    });

    it('rejects cancelling a POSTED journal entry', async () => {
      const entry = {
        id: 'je-1',
        companyId: 'company-a',
        status: JournalEntryStatus.Posted,
      };
      journalEntryRepository.findOne = jest.fn().mockResolvedValue(entry);

      await expect(service.cancel('je-1', 'company-a')).rejects.toMatchObject({
        errorCode: ErrorCode.Conflict,
      });
    });
  });

  describe('findByIdInCompany — cross-company isolation (IDOR)', () => {
    it('throws NotFound for a journal entry in a different company', async () => {
      journalEntryRepository.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        service.findByIdInCompany('je-1', 'company-b'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });
  });

  describe('createInternal — automatic (Payment) posting path (D6/D7/D13)', () => {
    it('creates a POSTED journal entry directly, validating balance first', async () => {
      const result = await service.createInternal({
        companyId: 'company-a',
        branchId: null,
        entryDate: new Date('2026-01-15T00:00:00Z'),
        description: 'Payment PMT-1',
        sourceType: JournalSourceType.Payment,
        sourceId: 'payment-1',
        userId: 'user-1',
        manager: manager as unknown as EntityManager,
        lines: [
          {
            accountId: 'account-1',
            debitAmount: '100.00',
            creditAmount: '0.00',
          },
          {
            accountId: 'account-2',
            debitAmount: '0.00',
            creditAmount: '100.00',
          },
        ],
      });

      expect(result.status).toBe(JournalEntryStatus.Posted);
      expect(result.sourceType).toBe(JournalSourceType.Payment);
      expect(result.sourceId).toBe('payment-1');
      expect(result.postedBy).toBe('user-1');
    });

    it('rejects an unbalanced internal posting attempt before creating anything', async () => {
      await expect(
        service.createInternal({
          companyId: 'company-a',
          branchId: null,
          entryDate: new Date('2026-01-15T00:00:00Z'),
          description: 'Payment PMT-1',
          sourceType: JournalSourceType.Payment,
          sourceId: 'payment-1',
          userId: 'user-1',
          manager: manager as unknown as EntityManager,
          lines: [
            {
              accountId: 'account-1',
              debitAmount: '100.00',
              creditAmount: '0.00',
            },
            {
              accountId: 'account-2',
              debitAmount: '0.00',
              creditAmount: '99.00',
            },
          ],
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });
  });
});
