import { EntityManager } from 'typeorm';
import { AccountingPeriodResolverService } from './accounting-period-resolver.service';
import { FiscalYearStatus } from '../entities/fiscal-year-status.enum';
import { AccountingPeriodStatus } from '../entities/accounting-period-status.enum';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('AccountingPeriodResolverService', () => {
  let service: AccountingPeriodResolverService;
  let manager: {
    createQueryBuilder: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let queryBuilder: {
    innerJoinAndSelect: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    getOne: jest.Mock;
  };

  beforeEach(() => {
    queryBuilder = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };
    manager = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      create: jest.fn((_entity, data: Record<string, unknown>) => data),
      save: jest.fn((_entity, data: Record<string, unknown>) =>
        Promise.resolve({ id: 'new-id', ...data }),
      ),
    };
    service = new AccountingPeriodResolverService();
  });

  it('returns an existing OPEN period under an OPEN fiscal year', async () => {
    const existingPeriod = {
      id: 'period-1',
      status: AccountingPeriodStatus.Open,
      fiscalYear: { status: FiscalYearStatus.Open },
    };
    queryBuilder.getOne.mockResolvedValue(existingPeriod);

    const result = await service.resolveOpenPeriod(
      'company-a',
      new Date('2026-03-15T00:00:00Z'),
      manager as unknown as EntityManager,
    );

    expect(result).toBe(existingPeriod);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejects (409) when the covering period is LOCKED', async () => {
    queryBuilder.getOne.mockResolvedValue({
      id: 'period-1',
      status: AccountingPeriodStatus.Locked,
      fiscalYear: { status: FiscalYearStatus.Open },
    });

    await expect(
      service.resolveOpenPeriod(
        'company-a',
        new Date('2026-03-15T00:00:00Z'),
        manager as unknown as EntityManager,
      ),
    ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
  });

  it('rejects (409) when the covering fiscal year is CLOSED', async () => {
    queryBuilder.getOne.mockResolvedValue({
      id: 'period-1',
      status: AccountingPeriodStatus.Open,
      fiscalYear: { status: FiscalYearStatus.Closed },
    });

    await expect(
      service.resolveOpenPeriod(
        'company-a',
        new Date('2026-03-15T00:00:00Z'),
        manager as unknown as EntityManager,
      ),
    ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
  });

  it('lazily creates a calendar-year FiscalYear + AccountingPeriod when none exists', async () => {
    queryBuilder.getOne
      .mockResolvedValueOnce(null) // primary lookup: no covering period
      .mockResolvedValueOnce(null); // race-guard re-check: still none

    const result = await service.resolveOpenPeriod(
      'company-a',
      new Date('2026-06-01T00:00:00Z'),
      manager as unknown as EntityManager,
    );

    expect(manager.save).toHaveBeenCalledTimes(2); // FiscalYear then AccountingPeriod
    expect(result.startDate).toBe('2026-01-01');
    expect(result.endDate).toBe('2026-12-31');
    expect(result.status).toBe(AccountingPeriodStatus.Open);
  });

  it('uses the race-guard result instead of creating a duplicate when a concurrent transaction already created one', async () => {
    const racedPeriod = {
      id: 'period-raced',
      status: AccountingPeriodStatus.Open,
    };
    queryBuilder.getOne
      .mockResolvedValueOnce(null) // primary lookup finds nothing
      .mockResolvedValueOnce(racedPeriod); // race-guard finds the concurrently-created row

    const result = await service.resolveOpenPeriod(
      'company-a',
      new Date('2026-06-01T00:00:00Z'),
      manager as unknown as EntityManager,
    );

    expect(result).toBe(racedPeriod);
    expect(manager.save).not.toHaveBeenCalled();
  });
});
