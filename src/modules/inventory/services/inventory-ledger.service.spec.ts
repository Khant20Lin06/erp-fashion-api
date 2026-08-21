import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { InventoryLedgerService } from './inventory-ledger.service';
import { StockMovement } from '../entities/stock-movement.entity';
import { WarehouseStock } from '../entities/warehouse-stock.entity';
import { StockMovementType } from '../entities/stock-movement-type.enum';
import { StockMovementReferenceType } from '../entities/stock-movement-reference-type.enum';
import { toStockCardEntryResponseDto } from '../dto/stock-card-entry-response.dto';
import { ErrorCode } from '../../../core/errors/error-codes';
import { ListInventoryLedgerDto } from '../dto/list-inventory-ledger.dto';

type MockQB<T extends ObjectLiteral> = jest.Mocked<
  Pick<
    SelectQueryBuilder<T>,
    | 'innerJoin'
    | 'where'
    | 'andWhere'
    | 'orderBy'
    | 'addOrderBy'
    | 'skip'
    | 'take'
    | 'select'
    | 'getManyAndCount'
    | 'getMany'
    | 'getOne'
    | 'getRawOne'
  >
>;

function makeQB<T extends ObjectLiteral>(): MockQB<T> {
  return {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    getMany: jest.fn(),
    getOne: jest.fn(),
    getRawOne: jest.fn(),
  };
}

describe('InventoryLedgerService', () => {
  let service: InventoryLedgerService;
  let movementQB: MockQB<StockMovement>;
  let stockQB: MockQB<WarehouseStock>;
  let movementRepository: jest.Mocked<
    Pick<Repository<StockMovement>, 'createQueryBuilder'>
  >;
  let stockRepository: jest.Mocked<
    Pick<Repository<WarehouseStock>, 'createQueryBuilder'>
  >;
  const listRepository = () =>
    ({
      find: jest.fn().mockResolvedValue([]),
    }) as unknown as Repository<never>;

  beforeEach(() => {
    movementQB = makeQB<StockMovement>();
    stockQB = makeQB<WarehouseStock>();
    movementRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(movementQB),
    };
    stockRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(stockQB),
    };

    service = new InventoryLedgerService(
      movementRepository as unknown as Repository<StockMovement>,
      stockRepository as unknown as Repository<WarehouseStock>,
      listRepository() as unknown as Repository<never>,
      listRepository() as unknown as Repository<never>,
      listRepository() as unknown as Repository<never>,
      listRepository() as unknown as Repository<never>,
      listRepository() as unknown as Repository<never>,
      listRepository() as unknown as Repository<never>,
      listRepository() as unknown as Repository<never>,
      listRepository() as unknown as Repository<never>,
      listRepository() as unknown as Repository<never>,
    );
  });

  function movement(overrides: Partial<StockMovement> = {}): StockMovement {
    return {
      id: 'mv-1',
      warehouseId: 'wh-1',
      productVariantId: 'var-1',
      movementType: StockMovementType.PurchaseReceipt,
      quantityChange: 10,
      quantityAfter: 10,
      referenceType: StockMovementReferenceType.GoodsReceipt,
      referenceId: 'gr-1',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      createdBy: 'user-1',
      ...overrides,
    } as StockMovement;
  }

  describe('findAll — filter dimensions', () => {
    beforeEach(() => {
      movementQB.getManyAndCount.mockResolvedValue([[], 0]);
    });

    it('always scopes to the resolved company via warehouse.companyId join', async () => {
      await service.findAll('company-a', {} as ListInventoryLedgerDto);
      expect(movementQB.innerJoin).toHaveBeenCalledWith(
        'movement.warehouse',
        'warehouse',
      );
      expect(movementQB.where).toHaveBeenCalledWith(
        'warehouse.companyId = :companyId',
        { companyId: 'company-a' },
      );
    });

    it('applies the warehouseId filter', async () => {
      await service.findAll('company-a', {
        warehouseId: 'wh-1',
      } as ListInventoryLedgerDto);
      expect(movementQB.andWhere).toHaveBeenCalledWith(
        'movement.warehouseId = :warehouseId',
        { warehouseId: 'wh-1' },
      );
    });

    it('applies the productVariantId filter', async () => {
      await service.findAll('company-a', {
        productVariantId: 'var-1',
      } as ListInventoryLedgerDto);
      expect(movementQB.andWhere).toHaveBeenCalledWith(
        'movement.productVariantId = :productVariantId',
        { productVariantId: 'var-1' },
      );
    });

    it('applies the movementType filter', async () => {
      await service.findAll('company-a', {
        movementType: StockMovementType.SaleIssue,
      } as ListInventoryLedgerDto);
      expect(movementQB.andWhere).toHaveBeenCalledWith(
        'movement.movementType = :movementType',
        { movementType: StockMovementType.SaleIssue },
      );
    });

    it('applies the referenceType filter', async () => {
      await service.findAll('company-a', {
        referenceType: StockMovementReferenceType.Sale,
      } as ListInventoryLedgerDto);
      expect(movementQB.andWhere).toHaveBeenCalledWith(
        'movement.referenceType = :referenceType',
        { referenceType: StockMovementReferenceType.Sale },
      );
    });

    it('applies the referenceId filter', async () => {
      await service.findAll('company-a', {
        referenceId: 'sale-1',
      } as ListInventoryLedgerDto);
      expect(movementQB.andWhere).toHaveBeenCalledWith(
        'movement.referenceId = :referenceId',
        { referenceId: 'sale-1' },
      );
    });

    it('applies the fromDate filter', async () => {
      await service.findAll('company-a', {
        fromDate: '2026-01-01',
      } as ListInventoryLedgerDto);
      expect(movementQB.andWhere).toHaveBeenCalledWith(
        'movement.createdAt >= :fromDate',
        { fromDate: '2026-01-01' },
      );
    });

    it('applies the toDate filter', async () => {
      await service.findAll('company-a', {
        toDate: '2026-01-31',
      } as ListInventoryLedgerDto);
      expect(movementQB.andWhere).toHaveBeenCalledWith(
        'movement.createdAt <= :toDate',
        { toDate: '2026-01-31' },
      );
    });
  });

  describe('findAll — invalid date range', () => {
    it('rejects fromDate > toDate with a 400 ValidationError, never silently swapping', async () => {
      await expect(
        service.findAll('company-a', {
          fromDate: '2026-02-01',
          toDate: '2026-01-01',
        } as ListInventoryLedgerDto),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
      expect(movementRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('accepts fromDate === toDate (not a violation)', async () => {
      movementQB.getManyAndCount.mockResolvedValue([[], 0]);
      await expect(
        service.findAll('company-a', {
          fromDate: '2026-01-01',
          toDate: '2026-01-01',
        } as ListInventoryLedgerDto),
      ).resolves.toBeDefined();
    });
  });

  describe('findAll — pagination', () => {
    it('applies default page/limit when not provided', async () => {
      movementQB.getManyAndCount.mockResolvedValue([[], 0]);
      const result = await service.findAll(
        'company-a',
        {} as ListInventoryLedgerDto,
      );
      expect(movementQB.skip).toHaveBeenCalledWith(0);
      expect(movementQB.take).toHaveBeenCalledWith(20);
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 0 });
    });

    it('applies a custom page/limit, computing skip correctly', async () => {
      movementQB.getManyAndCount.mockResolvedValue([[], 45]);
      const result = await service.findAll('company-a', {
        page: 3,
        limit: 10,
      } as ListInventoryLedgerDto);
      expect(movementQB.skip).toHaveBeenCalledWith(20);
      expect(movementQB.take).toHaveBeenCalledWith(10);
      expect(result.meta).toEqual({ page: 3, limit: 10, total: 45 });
    });
  });

  describe('findAll — sorting', () => {
    it('defaults to createdAt DESC with an id ASC deterministic tiebreak', async () => {
      movementQB.getManyAndCount.mockResolvedValue([[], 0]);
      await service.findAll('company-a', {} as ListInventoryLedgerDto);
      expect(movementQB.orderBy).toHaveBeenCalledWith(
        'movement.createdAt',
        'DESC',
      );
      expect(movementQB.addOrderBy).toHaveBeenCalledWith('movement.id', 'ASC');
    });

    it('honors an explicit allowed sort field and order', async () => {
      movementQB.getManyAndCount.mockResolvedValue([[], 0]);
      await service.findAll('company-a', {
        sort: 'quantityChange',
        order: 'ASC',
      } as ListInventoryLedgerDto);
      expect(movementQB.orderBy).toHaveBeenCalledWith(
        'movement.quantityChange',
        'ASC',
      );
    });

    it('rejects a sort field outside the allowlist', async () => {
      await expect(
        service.findAll('company-a', {
          sort: 'referenceId',
        } as ListInventoryLedgerDto),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });
  });

  describe('findByIdInCompany — cross-company isolation', () => {
    it('throws NotFound for a movement belonging to a different company', async () => {
      movementQB.getOne.mockResolvedValue(null);
      await expect(
        service.findByIdInCompany('mv-1', 'company-b'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });

    it('returns the row when it belongs to the resolved company', async () => {
      const row = movement();
      movementQB.getOne.mockResolvedValue(row);
      const result = await service.findByIdInCompany('mv-1', 'company-a');
      expect(result).toBe(row);
    });
  });

  describe('getStockCard', () => {
    it('rejects when warehouseId is missing', async () => {
      await expect(
        service.getStockCard('company-a', undefined, 'var-1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects when productVariantId is missing', async () => {
      await expect(
        service.getStockCard('company-a', 'wh-1', undefined),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('orders chronologically by createdAt ASC with id ASC as the deterministic tiebreak', async () => {
      movementQB.getMany.mockResolvedValue([]);
      await service.getStockCard('company-a', 'wh-1', 'var-1');
      expect(movementQB.orderBy).toHaveBeenCalledWith(
        'movement.createdAt',
        'ASC',
      );
      expect(movementQB.addOrderBy).toHaveBeenCalledWith('movement.id', 'ASC');
    });

    it('scopes to warehouseId + productVariantId + company', async () => {
      movementQB.getMany.mockResolvedValue([]);
      await service.getStockCard('company-a', 'wh-1', 'var-1');
      expect(movementQB.where).toHaveBeenCalledWith(
        'warehouse.companyId = :companyId',
        { companyId: 'company-a' },
      );
      expect(movementQB.andWhere).toHaveBeenCalledWith(
        'movement.warehouseId = :warehouseId',
        { warehouseId: 'wh-1' },
      );
      expect(movementQB.andWhere).toHaveBeenCalledWith(
        'movement.productVariantId = :productVariantId',
        { productVariantId: 'var-1' },
      );
    });
  });

  describe('balanceBefore/balanceAfter derivation (toStockCardEntryResponseDto)', () => {
    it('computes balanceBefore = quantityAfter - quantityChange, balanceAfter = quantityAfter verbatim', () => {
      const entity = movement({ quantityChange: 5, quantityAfter: 20 });
      const dto = toStockCardEntryResponseDto(entity);
      expect(dto.balanceBefore).toBe(15);
      expect(dto.balanceAfter).toBe(20);
    });

    it('correctly handles a negative quantityChange (e.g. SALE_ISSUE)', () => {
      const entity = movement({
        movementType: StockMovementType.SaleIssue,
        quantityChange: -3,
        quantityAfter: 12,
      });
      const dto = toStockCardEntryResponseDto(entity);
      expect(dto.balanceBefore).toBe(15);
      expect(dto.balanceAfter).toBe(12);
    });

    it('correctly handles a zero-crossing decrease down to zero', () => {
      const entity = movement({ quantityChange: -5, quantityAfter: 0 });
      const dto = toStockCardEntryResponseDto(entity);
      expect(dto.balanceBefore).toBe(5);
      expect(dto.balanceAfter).toBe(0);
    });
  });

  describe('getReconciliation', () => {
    it('rejects when warehouseId is missing', async () => {
      await expect(
        service.getReconciliation('company-a', undefined, 'var-1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects when productVariantId is missing', async () => {
      await expect(
        service.getReconciliation('company-a', 'wh-1', undefined),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('reports reconciled = true when ledgerBalance equals WarehouseStock.onHandQuantity', async () => {
      movementQB.getRawOne.mockResolvedValue({ total: '25' });
      stockQB.getOne.mockResolvedValue({
        onHandQuantity: 25,
      } as WarehouseStock);

      const result = await service.getReconciliation(
        'company-a',
        'wh-1',
        'var-1',
      );
      expect(result).toEqual({
        warehouseId: 'wh-1',
        productVariantId: 'var-1',
        warehouseStockBalance: 25,
        ledgerBalance: 25,
        difference: 0,
        reconciled: true,
      });
    });

    it('reports reconciled = false with the correct signed difference when balances disagree', async () => {
      movementQB.getRawOne.mockResolvedValue({ total: '25' });
      stockQB.getOne.mockResolvedValue({
        onHandQuantity: 30,
      } as WarehouseStock);

      const result = await service.getReconciliation(
        'company-a',
        'wh-1',
        'var-1',
      );
      expect(result.ledgerBalance).toBe(25);
      expect(result.warehouseStockBalance).toBe(30);
      // difference = warehouseStockBalance - ledgerBalance
      expect(result.difference).toBe(5);
      expect(result.reconciled).toBe(false);
    });

    it('reports a negative difference correctly when WarehouseStock is below the ledger sum', async () => {
      movementQB.getRawOne.mockResolvedValue({ total: '25' });
      stockQB.getOne.mockResolvedValue({
        onHandQuantity: 20,
      } as WarehouseStock);

      const result = await service.getReconciliation(
        'company-a',
        'wh-1',
        'var-1',
      );
      expect(result.difference).toBe(-5);
      expect(result.reconciled).toBe(false);
    });

    it('treats a pair with no WarehouseStock row yet as balance 0', async () => {
      movementQB.getRawOne.mockResolvedValue({ total: '0' });
      stockQB.getOne.mockResolvedValue(null);

      const result = await service.getReconciliation(
        'company-a',
        'wh-1',
        'var-1',
      );
      expect(result.warehouseStockBalance).toBe(0);
      expect(result.ledgerBalance).toBe(0);
      expect(result.reconciled).toBe(true);
    });
  });
});
