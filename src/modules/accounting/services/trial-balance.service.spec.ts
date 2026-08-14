import { Repository } from 'typeorm';
import { TrialBalanceService } from './trial-balance.service';
import { JournalEntryLine } from '../entities/journal-entry-line.entity';
import { JournalEntryStatus } from '../entities/journal-entry-status.enum';

describe('TrialBalanceService', () => {
  let service: TrialBalanceService;
  let lineRepository: jest.Mocked<
    Pick<Repository<JournalEntryLine>, 'createQueryBuilder'>
  >;
  let queryBuilder: Record<string, jest.Mock>;

  beforeEach(() => {
    queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    lineRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    service = new TrialBalanceService(
      lineRepository as unknown as Repository<JournalEntryLine>,
    );
  });

  it('filters to POSTED journal entries only (D5, LOCKED)', async () => {
    await service.query('company-a', {});

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'journalEntry.status = :status',
      { status: JournalEntryStatus.Posted },
    );
  });

  it('computes global totalDebit === totalCredit across all account rows', async () => {
    queryBuilder.getRawMany.mockResolvedValue([
      {
        accountId: 'a1',
        accountCode: 'CASH',
        accountName: 'Cash',
        accountType: 'ASSET',
        totalDebit: '150.00',
        totalCredit: '50.00',
      },
      {
        accountId: 'a2',
        accountCode: 'AR',
        accountName: 'Receivable',
        accountType: 'ASSET',
        totalDebit: '0.00',
        totalCredit: '100.00',
      },
    ]);

    const result = await service.query('company-a', {});

    expect(result.totalDebit).toBe('150.00');
    expect(result.totalCredit).toBe('150.00');
    expect(result.totalDebit).toBe(result.totalCredit);
    expect(result.rows).toHaveLength(2);
  });

  it('returns 0.00 totals when there are no posted lines', async () => {
    queryBuilder.getRawMany.mockResolvedValue([]);

    const result = await service.query('company-a', {});

    expect(result.totalDebit).toBe('0.00');
    expect(result.totalCredit).toBe('0.00');
    expect(result.rows).toEqual([]);
  });

  it('applies an asOfDate filter when provided', async () => {
    await service.query('company-a', { asOfDate: '2026-06-30' });

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'journalEntry.entryDate <= :asOfDate',
      { asOfDate: '2026-06-30' },
    );
  });

  it('applies allowedBranchIds when branchId is not provided', async () => {
    await service.query('company-a', {
      allowedBranchIds: ['branch-1', 'branch-2'],
    });

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'journalEntry.branchId IN (:...allowedBranchIds)',
      { allowedBranchIds: ['branch-1', 'branch-2'] },
    );
  });
});
