import { Repository } from 'typeorm';
import { GeneralLedgerService } from './general-ledger.service';
import { JournalEntryLine } from '../entities/journal-entry-line.entity';
import { JournalEntryStatus } from '../entities/journal-entry-status.enum';
import { GeneralLedgerQueryDto } from '../dto/general-ledger-query.dto';

/** Builds a query DTO from a partial plain object — PaginationDto's `skip` getter makes bare object literals structurally incompatible. */
function buildQuery(
  overrides: Partial<GeneralLedgerQueryDto> = {},
): GeneralLedgerQueryDto {
  return Object.assign(new GeneralLedgerQueryDto(), overrides);
}

describe('GeneralLedgerService', () => {
  let service: GeneralLedgerService;
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
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
      getCount: jest.fn().mockResolvedValue(0),
    };
    lineRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    service = new GeneralLedgerService(
      lineRepository as unknown as Repository<JournalEntryLine>,
    );
  });

  it('filters to POSTED journal entries only (D5, LOCKED)', async () => {
    await service.query('company-a', buildQuery());

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'journalEntry.status = :status',
      { status: JournalEntryStatus.Posted },
    );
  });

  it('scopes to the resolved companyId', async () => {
    await service.query('company-a', buildQuery());

    expect(queryBuilder.where).toHaveBeenCalledWith(
      'journalEntry.companyId = :companyId',
      { companyId: 'company-a' },
    );
  });

  it('applies an accountId filter when provided', async () => {
    await service.query('company-a', buildQuery({ accountId: 'account-1' }));

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'line.accountId = :accountId',
      { accountId: 'account-1' },
    );
  });

  it('applies fromDate/toDate filters when provided', async () => {
    await service.query(
      'company-a',
      buildQuery({ fromDate: '2026-01-01', toDate: '2026-01-31' }),
    );

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'journalEntry.entryDate >= :fromDate',
      { fromDate: '2026-01-01' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'journalEntry.entryDate <= :toDate',
      { toDate: '2026-01-31' },
    );
  });

  it('applies allowedBranchIds when branchId is not provided', async () => {
    await service.query(
      'company-a',
      buildQuery({ allowedBranchIds: ['branch-1', 'branch-2'] } as never),
    );

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'journalEntry.branchId IN (:...allowedBranchIds)',
      { allowedBranchIds: ['branch-1', 'branch-2'] },
    );
  });

  it('returns paginated rows with meta', async () => {
    queryBuilder.getRawMany.mockResolvedValue([{ journalEntryLineId: 'l1' }]);
    queryBuilder.getCount.mockResolvedValue(1);

    const result = await service.query(
      'company-a',
      buildQuery({ page: 1, limit: 20 }),
    );

    expect(result.data).toHaveLength(1);
    expect(result.meta).toEqual({ page: 1, limit: 20, total: 1 });
  });
});
