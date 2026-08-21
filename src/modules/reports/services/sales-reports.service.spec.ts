import { Repository } from 'typeorm';
import { SalesReportsService } from './sales-reports.service';
import { Sale } from '../../sales/entities/sale.entity';
import { SaleStatus } from '../../sales/entities/sale-status.enum';

describe('SalesReportsService', () => {
  let service: SalesReportsService;
  let saleRepository: jest.Mocked<Pick<Repository<Sale>, 'createQueryBuilder'>>;
  let queryBuilder: Record<string, jest.Mock>;

  beforeEach(() => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue(undefined),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    saleRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    service = new SalesReportsService(
      saleRepository as unknown as Repository<Sale>,
    );
  });

  it('filters to CONFIRMED sales only', async () => {
    await service.summary('company-a', {});

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'sale.status = :status',
      {
        status: SaleStatus.Confirmed,
      },
    );
  });

  it('applies branchId/fromDate/toDate filters when provided', async () => {
    await service.summary('company-a', {
      branchId: 'branch-1',
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
    });

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'sale.branchId = :branchId',
      {
        branchId: 'branch-1',
      },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'sale.transactionDate >= :fromDate',
      { fromDate: '2026-01-01' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'sale.transactionDate <= :toDate',
      { toDate: '2026-01-31' },
    );
  });

  it('applies allowedBranchIds when branchId is not provided', async () => {
    await service.summary('company-a', {
      allowedBranchIds: ['branch-1', 'branch-2'],
    });

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'sale.branchId IN (:...allowedBranchIds)',
      { allowedBranchIds: ['branch-1', 'branch-2'] },
    );
  });

  it('summary returns real aggregated totals, defaulting to zero when there is no data', async () => {
    queryBuilder.getRawOne.mockResolvedValue({
      saleCount: '3',
      grandTotal: '450.00',
      subtotal: '400.00',
      discountAmount: '10.00',
      taxAmount: '60.00',
    });

    const result = await service.summary('company-a', {});

    expect(result).toEqual({
      saleCount: 3,
      grandTotal: '450.00',
      subtotal: '400.00',
      discountAmount: '10.00',
      taxAmount: '60.00',
    });
  });

  it('summary defaults to zero counts/totals when the query returns nothing', async () => {
    const result = await service.summary('company-a', {});

    expect(result).toEqual({
      saleCount: 0,
      grandTotal: '0.00',
      subtotal: '0.00',
      discountAmount: '0.00',
      taxAmount: '0.00',
    });
  });

  it('byDate groups by DATE(transactionDate)', async () => {
    queryBuilder.getRawMany.mockResolvedValue([
      { date: '2026-08-01', saleCount: '2', grandTotal: '100.00' },
    ]);

    const result = await service.byDate('company-a', {});

    expect(queryBuilder.groupBy).toHaveBeenCalledWith(
      'DATE(sale.transactionDate)',
    );
    expect(queryBuilder.orderBy).toHaveBeenCalledWith(
      'DATE(sale.transactionDate)',
      'ASC',
    );
    expect(result).toEqual([
      { date: '2026-08-01', saleCount: 2, grandTotal: '100.00' },
    ]);
  });

  it('byDate uses a strict-mode-safe weekly bucket expression', async () => {
    await service.byDate('company-a', { granularity: 'weekly' });

    expect(queryBuilder.select).toHaveBeenCalledWith(
      'DATE_SUB(DATE(sale.transactionDate), INTERVAL WEEKDAY(sale.transactionDate) DAY)',
      'date',
    );
    expect(queryBuilder.groupBy).toHaveBeenCalledWith(
      'DATE_SUB(DATE(sale.transactionDate), INTERVAL WEEKDAY(sale.transactionDate) DAY)',
    );
    expect(queryBuilder.orderBy).toHaveBeenCalledWith(
      'DATE_SUB(DATE(sale.transactionDate), INTERVAL WEEKDAY(sale.transactionDate) DAY)',
      'ASC',
    );
  });

  it('byDate uses matching monthly select/group expressions', async () => {
    await service.byDate('company-a', { granularity: 'monthly' });

    expect(queryBuilder.select).toHaveBeenCalledWith(
      "DATE_FORMAT(sale.transactionDate, '%Y-%m-01')",
      'date',
    );
    expect(queryBuilder.groupBy).toHaveBeenCalledWith(
      "DATE_FORMAT(sale.transactionDate, '%Y-%m-01')",
    );
  });

  it('byDate uses matching yearly select/group expressions', async () => {
    await service.byDate('company-a', { granularity: 'yearly' });

    expect(queryBuilder.select).toHaveBeenCalledWith(
      "DATE_FORMAT(sale.transactionDate, '%Y-01-01')",
      'date',
    );
    expect(queryBuilder.groupBy).toHaveBeenCalledWith(
      "DATE_FORMAT(sale.transactionDate, '%Y-01-01')",
    );
  });

  it('byCustomer joins customer and groups by customer identity', async () => {
    queryBuilder.getRawMany.mockResolvedValue([
      {
        customerId: 'cust-1',
        customerCode: 'CUST-1',
        customerName: 'Acme',
        saleCount: '5',
        grandTotal: '750.00',
      },
    ]);

    const result = await service.byCustomer('company-a', {});

    expect(queryBuilder.innerJoin).toHaveBeenCalledWith(
      'sale.customer',
      'customer',
    );
    expect(result[0].customerCode).toBe('CUST-1');
    expect(result[0].grandTotal).toBe('750.00');
  });

  it('byBranch left-joins branch (so branch-less sales are still included)', async () => {
    queryBuilder.getRawMany.mockResolvedValue([]);

    await service.byBranch('company-a', {});

    expect(queryBuilder.leftJoin).toHaveBeenCalledWith('sale.branch', 'branch');
  });

  it('byProduct returns only real, query-derived fields — no fabricated profitMargin', async () => {
    queryBuilder.getRawMany.mockResolvedValue([
      { productName: 'Denim Jacket', unitsSold: '10', revenue: '500.00' },
    ]);

    const result = await service.byProduct('company-a', {});

    expect(result).toEqual([
      { productName: 'Denim Jacket', unitsSold: 10, revenue: '500.00' },
    ]);
    expect(result[0]).not.toHaveProperty('profitMargin');
  });
});
