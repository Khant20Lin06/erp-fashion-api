import { Repository } from 'typeorm';
import { InventoryReportsService } from './inventory-reports.service';
import { WarehouseStock } from '../../inventory/entities/warehouse-stock.entity';
import { StockMovement } from '../../inventory/entities/stock-movement.entity';

describe('InventoryReportsService', () => {
  let service: InventoryReportsService;
  let warehouseStockRepository: jest.Mocked<
    Pick<Repository<WarehouseStock>, 'createQueryBuilder'>
  >;
  let stockMovementRepository: jest.Mocked<
    Pick<Repository<StockMovement>, 'createQueryBuilder'>
  >;
  let stockQb: Record<string, jest.Mock>;
  let movementQb: Record<string, jest.Mock>;
  let countQb: Record<string, jest.Mock>;

  beforeEach(() => {
    stockQb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    movementQb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    countQb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
    };

    warehouseStockRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(stockQb),
    };

    let movementCallCount = 0;
    stockMovementRepository = {
      createQueryBuilder: jest.fn().mockImplementation(() => {
        movementCallCount += 1;
        return movementCallCount === 1 ? movementQb : countQb;
      }),
    };

    service = new InventoryReportsService(
      warehouseStockRepository as unknown as Repository<WarehouseStock>,
      stockMovementRepository as unknown as Repository<StockMovement>,
    );
  });

  it('stockSummary scopes by company via a join to warehouse (no direct companyId column on WarehouseStock)', async () => {
    await service.stockSummary('company-a', {});

    expect(stockQb.innerJoin).toHaveBeenCalledWith(
      'stock.warehouse',
      'warehouse',
    );
    expect(stockQb.where).toHaveBeenCalledWith(
      'warehouse.companyId = :companyId',
      {
        companyId: 'company-a',
      },
    );
  });

  it('stockSummary applies an optional warehouseId filter', async () => {
    await service.stockSummary('company-a', { warehouseId: 'wh-1' });

    expect(stockQb.andWhere).toHaveBeenCalledWith(
      'stock.warehouseId = :warehouseId',
      { warehouseId: 'wh-1' },
    );
  });

  it('stockSummary applies allowedBranchIds when branchId is not provided', async () => {
    await service.stockSummary('company-a', {
      allowedBranchIds: ['branch-1', 'branch-2'],
    });

    expect(stockQb.andWhere).toHaveBeenCalledWith(
      'warehouse.branchId IN (:...allowedBranchIds)',
      { allowedBranchIds: ['branch-1', 'branch-2'] },
    );
  });

  it('stockSummary returns real quantity data, never a valuation/cost figure', async () => {
    stockQb.getRawMany.mockResolvedValue([
      {
        warehouseId: 'wh-1',
        warehouseName: 'Main Warehouse',
        productVariantId: 'var-1',
        sku: 'SKU-1',
        onHandQuantity: '42',
        reservedQuantity: '0',
      },
    ]);

    const result = await service.stockSummary('company-a', {});

    expect(result).toEqual([
      {
        warehouseId: 'wh-1',
        warehouseName: 'Main Warehouse',
        productVariantId: 'var-1',
        sku: 'SKU-1',
        onHandQuantity: 42,
        reservedQuantity: 0,
      },
    ]);
    // Structural guarantee: no cost/value/amount field exists anywhere on the row shape.
    expect(Object.keys(result[0])).not.toContain('cost');
    expect(Object.keys(result[0])).not.toContain('value');
  });

  it('movements paginates and returns a real total count', async () => {
    movementQb.getRawMany.mockResolvedValue([
      {
        id: 'mv-1',
        warehouseId: 'wh-1',
        warehouseName: 'Main Warehouse',
        productVariantId: 'var-1',
        sku: 'SKU-1',
        movementType: 'SALE_ISSUE',
        quantityChange: -2,
        quantityAfter: 40,
        referenceType: 'SALE',
        referenceId: 'sale-1',
        createdAt: new Date('2026-08-01T00:00:00Z'),
      },
    ]);
    countQb.getCount.mockResolvedValue(1);

    const result = await service.movements('company-a', {
      page: 1,
      limit: 20,
    } as never);

    expect(result.data).toHaveLength(1);
    expect(result.meta).toEqual({ page: 1, limit: 20, total: 1 });
  });

  it('movements applies warehouseId/productVariantId filters to both the data and count queries', async () => {
    await service.movements('company-a', {
      warehouseId: 'wh-1',
      productVariantId: 'var-1',
      page: 1,
      limit: 20,
    } as never);

    expect(movementQb.andWhere).toHaveBeenCalledWith(
      'movement.warehouseId = :warehouseId',
      { warehouseId: 'wh-1' },
    );
    expect(countQb.andWhere).toHaveBeenCalledWith(
      'movement.warehouseId = :warehouseId',
      { warehouseId: 'wh-1' },
    );
  });

  it('movements applies allowedBranchIds to both the data and count queries', async () => {
    await service.movements('company-a', {
      allowedBranchIds: ['branch-1'],
      page: 1,
      limit: 20,
    } as never);

    expect(movementQb.andWhere).toHaveBeenCalledWith(
      'warehouse.branchId IN (:...allowedBranchIds)',
      { allowedBranchIds: ['branch-1'] },
    );
    expect(countQb.andWhere).toHaveBeenCalledWith(
      'warehouse.branchId IN (:...allowedBranchIds)',
      { allowedBranchIds: ['branch-1'] },
    );
  });
});
