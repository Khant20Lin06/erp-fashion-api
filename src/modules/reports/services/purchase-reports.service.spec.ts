import { Repository } from 'typeorm';
import { PurchaseReportsService } from './purchase-reports.service';
import { PurchaseOrder } from '../../purchase/entities/purchase-order.entity';
import { PurchaseOrderStatus } from '../../purchase/entities/purchase-order-status.enum';

describe('PurchaseReportsService', () => {
  let service: PurchaseReportsService;
  let purchaseOrderRepository: jest.Mocked<
    Pick<Repository<PurchaseOrder>, 'createQueryBuilder'>
  >;
  let queryBuilder: Record<string, jest.Mock>;

  beforeEach(() => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue(undefined),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    purchaseOrderRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    service = new PurchaseReportsService(
      purchaseOrderRepository as unknown as Repository<PurchaseOrder>,
    );
  });

  it('filters to CONFIRMED purchase orders only', async () => {
    await service.summary('company-a', {});

    expect(queryBuilder.andWhere).toHaveBeenCalledWith('po.status = :status', {
      status: PurchaseOrderStatus.Confirmed,
    });
  });

  it('applies branchId/fromDate/toDate filters when provided', async () => {
    await service.summary('company-a', {
      branchId: 'branch-1',
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
    });

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'po.branchId = :branchId',
      {
        branchId: 'branch-1',
      },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'po.transactionDate >= :fromDate',
      { fromDate: '2026-01-01' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'po.transactionDate <= :toDate',
      { toDate: '2026-01-31' },
    );
  });

  it('applies allowedBranchIds when branchId is not provided', async () => {
    await service.summary('company-a', {
      allowedBranchIds: ['branch-1', 'branch-2'],
    });

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'po.branchId IN (:...allowedBranchIds)',
      { allowedBranchIds: ['branch-1', 'branch-2'] },
    );
  });

  it('summary returns real aggregated totals', async () => {
    queryBuilder.getRawOne.mockResolvedValue({
      purchaseOrderCount: '2',
      grandTotal: '900.00',
      subtotal: '850.00',
      discountAmount: '0.00',
      taxAmount: '50.00',
    });

    const result = await service.summary('company-a', {});

    expect(result).toEqual({
      purchaseOrderCount: 2,
      grandTotal: '900.00',
      subtotal: '850.00',
      discountAmount: '0.00',
      taxAmount: '50.00',
    });
  });

  it('summary defaults to zero when there is no data', async () => {
    const result = await service.summary('company-a', {});

    expect(result.purchaseOrderCount).toBe(0);
    expect(result.grandTotal).toBe('0.00');
  });

  it('byDate groups by DATE(transactionDate)', async () => {
    queryBuilder.getRawMany.mockResolvedValue([
      { date: '2026-08-01', purchaseOrderCount: '1', grandTotal: '300.00' },
    ]);

    const result = await service.byDate('company-a', {});

    expect(queryBuilder.groupBy).toHaveBeenCalledWith(
      'DATE(po.transactionDate)',
    );
    expect(result).toEqual([
      { date: '2026-08-01', purchaseOrderCount: 1, grandTotal: '300.00' },
    ]);
  });

  it('bySupplier joins supplier and groups by supplier identity', async () => {
    queryBuilder.getRawMany.mockResolvedValue([
      {
        supplierId: 'sup-1',
        supplierCode: 'SUP-1',
        supplierName: 'Widgets Inc',
        purchaseOrderCount: '4',
        grandTotal: '1200.00',
      },
    ]);

    const result = await service.bySupplier('company-a', {});

    expect(queryBuilder.innerJoin).toHaveBeenCalledWith(
      'po.supplier',
      'supplier',
    );
    expect(result[0].supplierCode).toBe('SUP-1');
  });
});
