import { Repository, SelectQueryBuilder } from 'typeorm';
import { BalanceSheetService } from './balance-sheet.service';
import { JournalEntryLine } from '../../accounting/entities/journal-entry-line.entity';
import { AccountType } from '../../accounting/entities/account-type.enum';

describe('BalanceSheetService', () => {
  let service: BalanceSheetService;
  let lineRepository: jest.Mocked<
    Pick<Repository<JournalEntryLine>, 'createQueryBuilder'>
  >;
  let queryBuilder: jest.Mocked<
    Pick<
      SelectQueryBuilder<JournalEntryLine>,
      | 'innerJoin'
      | 'where'
      | 'andWhere'
      | 'select'
      | 'groupBy'
      | 'addGroupBy'
      | 'orderBy'
      | 'getRawMany'
    >
  >;

  beforeEach(() => {
    queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
    };
    lineRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    service = new BalanceSheetService(
      lineRepository as unknown as Repository<JournalEntryLine>,
    );
  });

  it('filters to Asset/Liability/Equity account types only', async () => {
    queryBuilder.getRawMany.mockResolvedValue([]);

    await service.query('company-1', {});

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'account.accountType IN (:...types)',
      {
        types: [AccountType.Asset, AccountType.Liability, AccountType.Equity],
      },
    );
  });

  it('computes Asset balance as debit - credit', async () => {
    queryBuilder.getRawMany.mockResolvedValue([
      {
        accountId: 'acc-1',
        accountCode: 'A100',
        accountName: 'Cash',
        accountType: AccountType.Asset,
        totalDebit: '150.00',
        totalCredit: '50.00',
      },
    ]);

    const result = await service.query('company-1', {});

    expect(result.assets.rows).toEqual([
      {
        accountId: 'acc-1',
        accountCode: 'A100',
        accountName: 'Cash',
        balance: '100.00',
      },
    ]);
    expect(result.assets.total).toBe('100.00');
  });

  it('computes Liability/Equity balance as credit - debit', async () => {
    queryBuilder.getRawMany.mockResolvedValue([
      {
        accountId: 'acc-2',
        accountCode: 'L100',
        accountName: 'Accounts Payable',
        accountType: AccountType.Liability,
        totalDebit: '20.00',
        totalCredit: '80.00',
      },
    ]);

    const result = await service.query('company-1', {});

    expect(result.liabilities.rows[0].balance).toBe('60.00');
  });

  it('reports balanced=true when Assets equal Liabilities + Equity', async () => {
    queryBuilder.getRawMany.mockResolvedValue([
      {
        accountId: 'acc-1',
        accountCode: 'A100',
        accountName: 'Cash',
        accountType: AccountType.Asset,
        totalDebit: '100.00',
        totalCredit: '0.00',
      },
      {
        accountId: 'acc-2',
        accountCode: 'L100',
        accountName: 'Payable',
        accountType: AccountType.Liability,
        totalDebit: '0.00',
        totalCredit: '40.00',
      },
      {
        accountId: 'acc-3',
        accountCode: 'E100',
        accountName: 'Owner Equity',
        accountType: AccountType.Equity,
        totalDebit: '0.00',
        totalCredit: '60.00',
      },
    ]);

    const result = await service.query('company-1', {});

    expect(result.balanced).toBe(true);
    expect(result.totalLiabilitiesAndEquity).toBe('100.00');
  });

  it('reports balanced=false when the books do not balance', async () => {
    queryBuilder.getRawMany.mockResolvedValue([
      {
        accountId: 'acc-1',
        accountCode: 'A100',
        accountName: 'Cash',
        accountType: AccountType.Asset,
        totalDebit: '100.00',
        totalCredit: '0.00',
      },
      {
        accountId: 'acc-2',
        accountCode: 'L100',
        accountName: 'Payable',
        accountType: AccountType.Liability,
        totalDebit: '0.00',
        totalCredit: '40.00',
      },
    ]);

    const result = await service.query('company-1', {});

    expect(result.balanced).toBe(false);
  });

  it('defaults asOfDate to today when not supplied', async () => {
    queryBuilder.getRawMany.mockResolvedValue([]);

    const result = await service.query('company-1', {});

    expect(result.asOfDate).toBe(new Date().toISOString().slice(0, 10));
  });

  it('applies allowedBranchIds when branchId is not provided', async () => {
    queryBuilder.getRawMany.mockResolvedValue([]);

    await service.query('company-1', {
      allowedBranchIds: ['branch-1', 'branch-2'],
    });

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'journalEntry.branchId IN (:...allowedBranchIds)',
      { allowedBranchIds: ['branch-1', 'branch-2'] },
    );
  });
});
