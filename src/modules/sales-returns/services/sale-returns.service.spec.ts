import { EntityManager, Repository } from 'typeorm';
import { SaleReturnsService } from './sale-returns.service';
import { SaleReturn } from '../entities/sale-return.entity';
import { SaleReturnItem } from '../entities/sale-return-item.entity';
import { SaleReturnStatus } from '../entities/sale-return-status.enum';
import { Sale } from '../../sales/entities/sale.entity';
import { SaleStatus } from '../../sales/entities/sale-status.enum';
import { SaleItem } from '../../sales/entities/sale-item.entity';
import { WarehouseStock } from '../../inventory/entities/warehouse-stock.entity';
import { LoyaltyService } from '../../loyalty/services/loyalty.service';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('SaleReturnsService', () => {
  let service: SaleReturnsService;
  let saleReturnRepository: jest.Mocked<
    Pick<Repository<SaleReturn>, 'findOne'>
  >;
  let saleReturnItemRepository: jest.Mocked<
    Pick<Repository<SaleReturnItem>, 'find'>
  >;
  let loyaltyService: jest.Mocked<Pick<LoyaltyService, 'reverseForSaleReturn'>>;
  let transactionService: jest.Mocked<Pick<TransactionService, 'run'>>;

  interface MockManager {
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    query: jest.Mock;
    createQueryBuilder: jest.Mock;
  }
  let manager: MockManager;
  let saleItemQueryBuilder: {
    where: jest.Mock;
    andWhere: jest.Mock;
    setLock: jest.Mock;
    getOne: jest.Mock;
  };
  let saleReturnQueryBuilder: {
    where: jest.Mock;
    andWhere: jest.Mock;
    setLock: jest.Mock;
    getOne: jest.Mock;
  };
  let remainingQtyQueryBuilder: {
    innerJoin: jest.Mock;
    select: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    getRawOne: jest.Mock;
  };
  let counterQueryBuilder: {
    where: jest.Mock;
    andWhere: jest.Mock;
    setLock: jest.Mock;
    getOneOrFail: jest.Mock;
  };

  const buildSale = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'sale-1',
      companyId: 'company-a',
      customerId: 'cust-1',
      branchId: 'branch-1',
      warehouseId: 'wh-1',
      status: SaleStatus.Confirmed,
      currency: 'USD',
      grandTotal: '200.00',
      ...overrides,
    }) as Sale;

  const buildSaleItem = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'item-1',
      saleId: 'sale-1',
      productVariantId: 'variant-1',
      quantity: 10,
      unitPriceSnapshot: '20.00',
      productNameSnapshot: 'Test Product',
      skuSnapshot: 'SKU-1',
      ...overrides,
    }) as SaleItem;

  const buildSaleReturn = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'return-1',
      companyId: 'company-a',
      saleId: 'sale-1',
      customerId: 'cust-1',
      status: SaleReturnStatus.Draft,
      refundAmount: '100.00',
      refundedAmount: '0.00',
      ...overrides,
    }) as SaleReturn;

  const buildStock = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'stock-1',
      warehouseId: 'wh-1',
      productVariantId: 'variant-1',
      onHandQuantity: 5,
      ...overrides,
    }) as WarehouseStock;

  beforeEach(() => {
    saleReturnRepository = { findOne: jest.fn() };
    saleReturnItemRepository = { find: jest.fn() };
    loyaltyService = {
      reverseForSaleReturn: jest.fn().mockResolvedValue(null),
    };

    saleItemQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(buildSaleItem()),
    };
    saleReturnQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(buildSaleReturn()),
    };
    remainingQtyQueryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ returned: '0' }),
    };
    counterQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOneOrFail: jest
        .fn()
        .mockResolvedValue({ id: 'counter-1', lastSequence: 0 }),
    };

    manager = {
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((_entity: unknown, data: unknown) => data),
      save: jest.fn((_entity: unknown, data: unknown) => Promise.resolve(data)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      query: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn((entity: unknown) => {
        if (entity === SaleItem) return saleItemQueryBuilder;
        if (entity === SaleReturn) return saleReturnQueryBuilder;
        if (entity === SaleReturnItem) return remainingQtyQueryBuilder;
        return counterQueryBuilder;
      }),
    };

    transactionService = {
      run: jest
        .fn()
        .mockImplementation((work: (m: EntityManager) => Promise<unknown>) =>
          work(manager as unknown as EntityManager),
        ),
    };

    service = new SaleReturnsService(
      saleReturnRepository as unknown as Repository<SaleReturn>,
      saleReturnItemRepository as unknown as Repository<SaleReturnItem>,
      loyaltyService as unknown as LoyaltyService,
      transactionService as unknown as TransactionService,
    );

    manager.findOne.mockImplementation((entity: unknown) => {
      if (entity === Sale) return Promise.resolve(buildSale());
      return Promise.resolve(null);
    });
  });

  const baseDto = {
    companyId: 'company-a',
    saleId: 'sale-1',
    items: [{ saleItemId: 'item-1', quantity: 3 }],
  };

  describe('create', () => {
    it('creates a partial return within the remaining returnable quantity', async () => {
      const result = await service.create('company-a', 'user-1', baseDto);
      expect(result.returnNumber).toMatch(/^RET-\d{4}-\d{6}$/);
      expect(result.refundAmount).toBe('60.00'); // 3 * 20.00
    });

    it('creates a full return for the entire sold quantity', async () => {
      const result = await service.create('company-a', 'user-1', {
        ...baseDto,
        items: [{ saleItemId: 'item-1', quantity: 10 }],
      });
      expect(result.refundAmount).toBe('200.00');
    });

    it('rejects over-returning beyond the remaining returnable quantity (409)', async () => {
      remainingQtyQueryBuilder.getRawOne.mockResolvedValue({ returned: '8' });
      // remaining = 10 - 8 = 2, requesting 3

      await expect(
        service.create('company-a', 'user-1', baseDto),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('rejects a return against a sale from a different company (cross-company isolation)', async () => {
      manager.findOne.mockImplementation((entity: unknown) => {
        if (entity === Sale) return Promise.resolve(null);
        return Promise.resolve(null);
      });

      await expect(
        service.create('company-b', 'user-1', baseDto),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects returning from a non-CONFIRMED sale', async () => {
      manager.findOne.mockImplementation((entity: unknown) => {
        if (entity === Sale) {
          return Promise.resolve(buildSale({ status: SaleStatus.Draft }));
        }
        return Promise.resolve(null);
      });

      await expect(
        service.create('company-a', 'user-1', baseDto),
      ).rejects.toMatchObject({ errorCode: ErrorCode.UnprocessableEntity });
    });

    it('rejects a saleItemId that does not belong to the sale', async () => {
      saleItemQueryBuilder.getOne.mockResolvedValue(null);

      await expect(
        service.create('company-a', 'user-1', baseDto),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });
  });

  describe('confirm — inventory restock', () => {
    it('increases WarehouseStock.onHandQuantity and writes a SALE_RETURN movement for a RESTOCK item', async () => {
      manager.find.mockImplementation((entity: unknown) => {
        if (entity === SaleReturnItem) {
          return Promise.resolve([
            {
              id: 'sri-1',
              saleReturnId: 'return-1',
              productVariantId: 'variant-1',
              quantity: 3,
              condition: 'RESTOCK',
            },
          ]);
        }
        return Promise.resolve([]);
      });
      manager.findOneOrFail.mockResolvedValue(buildSale());

      const stock = buildStock({ onHandQuantity: 5 });
      const savedByEntity: Array<{
        entity: unknown;
        data: Record<string, unknown>;
      }> = [];
      manager.save.mockImplementation((entity: unknown, data: unknown) => {
        savedByEntity.push({ entity, data: data as Record<string, unknown> });
        return Promise.resolve(data);
      });

      // lockWarehouseStockRow does manager.query then createQueryBuilder(WarehouseStock)...getOneOrFail
      manager.createQueryBuilder.mockImplementation((entity: unknown) => {
        if (entity === WarehouseStock) {
          return {
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            setLock: jest.fn().mockReturnThis(),
            getOneOrFail: jest.fn().mockResolvedValue(stock),
          };
        }
        if (entity === SaleReturn) return saleReturnQueryBuilder;
        return counterQueryBuilder;
      });

      await service.confirm('return-1', 'company-a', 'user-1');

      const movement = savedByEntity.find(
        (s) =>
          (s.data as { movementType?: string }).movementType === 'SALE_RETURN',
      );
      expect(movement).toBeDefined();
      expect(movement?.data.quantityChange).toBe(3);
      expect(stock.onHandQuantity).toBe(8); // 5 + 3
    });

    it('rejects confirming a non-DRAFT return', async () => {
      saleReturnQueryBuilder.getOne.mockResolvedValue(
        buildSaleReturn({ status: SaleReturnStatus.Confirmed }),
      );

      await expect(
        service.confirm('return-1', 'company-a', 'user-1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.UnprocessableEntity });
    });
  });

  describe('cancel', () => {
    it('allows DRAFT -> CANCELLED', async () => {
      manager.findOne.mockResolvedValue(buildSaleReturn());

      const result = await service.cancel('return-1', 'company-a');
      expect(result.status).toBe(SaleReturnStatus.Cancelled);
    });

    it('rejects cancelling a CONFIRMED return', async () => {
      manager.findOne.mockResolvedValue(
        buildSaleReturn({ status: SaleReturnStatus.Confirmed }),
      );

      await expect(
        service.cancel('return-1', 'company-a'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.UnprocessableEntity });
    });
  });

  describe('applyRefund — over-refund and duplicate-refund prevention', () => {
    beforeEach(() => {
      saleReturnQueryBuilder.getOne.mockResolvedValue(
        buildSaleReturn({ status: SaleReturnStatus.Confirmed }),
      );
    });

    it('applies a partial refund and keeps status CONFIRMED', async () => {
      await service.applyRefund(
        'return-1',
        'company-a',
        40,
        manager as unknown as EntityManager,
      );
      expect(manager.update).toHaveBeenCalledWith(
        SaleReturn,
        'return-1',
        expect.objectContaining({
          refundedAmount: '40.00',
          status: SaleReturnStatus.Confirmed,
        }),
      );
    });

    it('flips to REFUNDED once the full eligible amount is allocated', async () => {
      await service.applyRefund(
        'return-1',
        'company-a',
        100,
        manager as unknown as EntityManager,
      );
      expect(manager.update).toHaveBeenCalledWith(
        SaleReturn,
        'return-1',
        expect.objectContaining({ status: SaleReturnStatus.Refunded }),
      );
    });

    it('rejects a refund that would exceed the eligible refund amount', async () => {
      await expect(
        service.applyRefund(
          'return-1',
          'company-a',
          150,
          manager as unknown as EntityManager,
        ),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('rejects a second refund attempt after the return is already fully refunded (duplicate-refund prevention)', async () => {
      saleReturnQueryBuilder.getOne.mockResolvedValue(
        buildSaleReturn({
          status: SaleReturnStatus.Refunded,
          refundedAmount: '100.00',
        }),
      );

      await expect(
        service.applyRefund(
          'return-1',
          'company-a',
          10,
          manager as unknown as EntityManager,
        ),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });
  });

  describe('cross-company isolation', () => {
    it('findByIdInCompany throws NotFound for a return in a different company', async () => {
      saleReturnRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findByIdInCompany('return-1', 'company-b'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });
  });
});
