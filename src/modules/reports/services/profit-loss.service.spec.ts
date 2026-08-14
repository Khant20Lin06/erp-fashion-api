import { Repository, SelectQueryBuilder } from 'typeorm';
import { ProfitLossService } from './profit-loss.service';
import { JournalEntryLine } from '../../accounting/entities/journal-entry-line.entity';
import { AccountType } from '../../accounting/entities/account-type.enum';

describe('ProfitLossService', () => {
  let service: ProfitLossService;
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
    service = new ProfitLossService(
      lineRepository as unknown as Repository<JournalEntryLine>,
    );
  });

  it('filters to Revenue/Expense account types only', async () => {
    queryBuilder.getRawMany.mockResolvedValue([]);

    await service.query('company-1', {});

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'account.accountType IN (:...types)',
      { types: [AccountType.Revenue, AccountType.Expense] },
    );
  });

  it('applies fromDate/toDate filters when supplied', async () => {
    queryBuilder.getRawMany.mockResolvedValue([]);

    await service.query('company-1', {
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
    });

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'journalEntry.entryDate >= :fromDate',
      { fromDate: '2026-01-01' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'journalEntry.entryDate <= :toDate',
      { toDate: '2026-01-31' },
    );
  });

  it('computes Revenue amount as credit - debit', async () => {
    queryBuilder.getRawMany.mockResolvedValue([
      {
        accountId: 'acc-1',
        accountCode: 'R100',
        accountName: 'Sales Revenue',
        accountType: AccountType.Revenue,
        totalDebit: '10.00',
        totalCredit: '110.00',
      },
    ]);

    const result = await service.query('company-1', {});

    expect(result.revenue.rows[0].amount).toBe('100.00');
    expect(result.revenue.total).toBe('100.00');
  });

  it('computes Expense amount as debit - credit', async () => {
    queryBuilder.getRawMany.mockResolvedValue([
      {
        accountId: 'acc-2',
        accountCode: 'X100',
        accountName: 'Rent Expense',
        accountType: AccountType.Expense,
        totalDebit: '75.00',
        totalCredit: '5.00',
      },
    ]);

    const result = await service.query('company-1', {});

    expect(result.expense.rows[0].amount).toBe('70.00');
  });

  it('computes netIncome as totalRevenue - totalExpense', async () => {
    queryBuilder.getRawMany.mockResolvedValue([
      {
        accountId: 'acc-1',
        accountCode: 'R100',
        accountName: 'Revenue',
        accountType: AccountType.Revenue,
        totalDebit: '0.00',
        totalCredit: '500.00',
      },
      {
        accountId: 'acc-2',
        accountCode: 'X100',
        accountName: 'Expense',
        accountType: AccountType.Expense,
        totalDebit: '300.00',
        totalCredit: '0.00',
      },
    ]);

    const result = await service.query('company-1', {});

    expect(result.netIncome).toBe('200.00');
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
