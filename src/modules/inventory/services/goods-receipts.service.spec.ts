import { EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import { GoodsReceiptsService } from './goods-receipts.service';
import { GoodsReceipt } from '../entities/goods-receipt.entity';
import { GoodsReceiptItem } from '../entities/goods-receipt-item.entity';
import { PurchaseOrder } from '../../purchase/entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../purchase/entities/purchase-order-item.entity';
import { PurchaseOrderStatus } from '../../purchase/entities/purchase-order-status.enum';
import { WarehouseStock } from '../entities/warehouse-stock.entity';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { WarehousesService } from '../../organization/services/warehouses.service';
import { WarehouseStatus } from '../../organization/entities/warehouse-status.enum';
import { ProductVariant } from '../../products/entities/product-variant.entity';
import { ProductVariantStatus } from '../../products/entities/product-variant-status.enum';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('GoodsReceiptsService', () => {
  let service: GoodsReceiptsService;
  let goodsReceiptRepository: jest.Mocked<
    Pick<Repository<GoodsReceipt>, 'findOne' | 'createQueryBuilder'>
  >;
  let transactionService: jest.Mocked<Pick<TransactionService, 'run'>>;
  let warehousesService: jest.Mocked<Pick<WarehousesService, 'findById'>>;
  let queryBuilder: jest.Mocked<
    Pick<
      SelectQueryBuilder<GoodsReceipt>,
      | 'leftJoinAndSelect'
      | 'where'
      | 'andWhere'
      | 'orderBy'
      | 'distinct'
      | 'skip'
      | 'take'
      | 'getManyAndCount'
    >
  >;

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

  // Separate mock query-builder chains: one for locking
  // PurchaseOrderItem, one for locking WarehouseStock, one for summing
  // prior handled GoodsReceiptItem quantity (received + rejected) —
  // distinguished by which entity class createQueryBuilder was invoked for.
  let poiQueryBuilder: {
    where: jest.Mock;
    andWhere: jest.Mock;
    setLock: jest.Mock;
    getOne: jest.Mock;
  };
  let stockQueryBuilder: {
    where: jest.Mock;
    andWhere: jest.Mock;
    setLock: jest.Mock;
    getOneOrFail: jest.Mock;
  };
  let sumQueryBuilder: {
    select: jest.Mock;
    where: jest.Mock;
    setLock: jest.Mock;
    getRawOne: jest.Mock;
  };

  const buildWarehouse = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'wh-1',
      companyId: 'company-a',
      branchId: 'branch-1',
      status: WarehouseStatus.Active,
      ...overrides,
    }) as never;

  const buildPurchaseOrder = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'po-1',
      companyId: 'company-a',
      supplierId: 'sup-1',
      status: PurchaseOrderStatus.Confirmed,
      ...overrides,
    }) as PurchaseOrder;

  const buildPoi = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'poi-1',
      purchaseOrderId: 'po-1',
      productVariantId: 'variant-1',
      quantity: 10,
      conversionFactorToBaseSnapshot: '1.0000',
      baseQuantitySnapshot: 10,
      uomId: null,
      uomCodeSnapshot: null,
      uomNameSnapshot: null,
      ...overrides,
    }) as PurchaseOrderItem;

  const buildVariant = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'variant-1',
      companyId: 'company-a',
      status: ProductVariantStatus.Active,
      ...overrides,
    }) as never;

  const buildStock = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'stock-1',
      warehouseId: 'wh-1',
      productVariantId: 'variant-1',
      onHandQuantity: 0,
      reservedQuantity: 0,
      ...overrides,
    }) as WarehouseStock;

  beforeEach(() => {
    queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      distinct: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };
    goodsReceiptRepository = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };

    poiQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(buildPoi()),
    };
    stockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOneOrFail: jest.fn().mockResolvedValue(buildStock()),
    };
    sumQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
    };

    manager = {
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((_entity: unknown, data: unknown) => data),
      save: jest.fn((_entity: unknown, data: unknown) => Promise.resolve(data)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      query: jest.fn(),
      createQueryBuilder: jest.fn((entity: unknown) => {
        if (entity === PurchaseOrderItem) return poiQueryBuilder;
        if (entity === WarehouseStock) return stockQueryBuilder;
        if (entity === GoodsReceiptItem) return sumQueryBuilder;
        // CompanyGoodsReceiptCounter path
        return {
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          setLock: jest.fn().mockReturnThis(),
          getOneOrFail: jest
            .fn()
            .mockResolvedValue({ id: 'counter-1', lastSequence: 0 }),
        };
      }),
    };

    transactionService = {
      run: jest
        .fn()
        .mockImplementation((work: (m: EntityManager) => Promise<unknown>) =>
          work(manager as unknown as EntityManager),
        ),
    };
    warehousesService = {
      findById: jest.fn().mockResolvedValue(buildWarehouse()),
    };

    service = new GoodsReceiptsService(
      goodsReceiptRepository as unknown as Repository<GoodsReceipt>,
      transactionService as unknown as TransactionService,
      warehousesService as unknown as WarehousesService,
    );

    manager.findOne.mockImplementation((entity: unknown) => {
      if (entity === PurchaseOrder)
        return Promise.resolve(buildPurchaseOrder());
      if (entity === ProductVariant) return Promise.resolve(buildVariant());
      if (entity === WarehouseStock)
        return Promise.resolve(buildStock({ onHandQuantity: 5 }));
      return Promise.resolve(null);
    });
    manager.findOneOrFail.mockImplementation((entity: unknown) => {
      if (entity === WarehouseStock)
        return Promise.resolve(buildStock({ onHandQuantity: 5 }));
      return Promise.resolve(null);
    });
  });

  const baseDto = {
    purchaseOrderId: 'po-1',
    warehouseId: 'wh-1',
    items: [
      {
        purchaseOrderItemId: 'poi-1',
        productVariantId: 'variant-1',
        receivedQuantity: 5,
      },
    ],
  };

  describe('findAll', () => {
    it('joins receipt items so downstream workflow screens can compute received coverage', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll('company-a', { companyId: 'company-a' });

      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'gr.items',
        'items',
      );
      expect(queryBuilder.distinct).toHaveBeenCalledWith(true);
    });
  });

  describe('create', () => {
    it('rejects an inactive warehouse', async () => {
      warehousesService.findById.mockResolvedValue(
        buildWarehouse({ status: WarehouseStatus.Inactive }),
      );

      await expect(
        service.create('company-a', 'user-1', baseDto as never),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects a cross-company warehouse', async () => {
      warehousesService.findById.mockResolvedValue(
        buildWarehouse({ companyId: 'company-b' }),
      );

      await expect(
        service.create('company-a', 'user-1', baseDto as never),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects a warehouse outside the purchase order branch', async () => {
      warehousesService.findById.mockResolvedValue(
        buildWarehouse({ branchId: 'branch-other' }),
      );
      manager.findOne.mockImplementation((entity: unknown) => {
        if (entity === PurchaseOrder)
          return Promise.resolve(buildPurchaseOrder({ branchId: 'branch-1' }));
        if (entity === ProductVariant) return Promise.resolve(buildVariant());
        return Promise.resolve(null);
      });

      await expect(
        service.create('company-a', 'user-1', baseDto as never),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects a warehouse that does not match the purchase order warehouse', async () => {
      warehousesService.findById.mockResolvedValue(
        buildWarehouse({ id: 'wh-other', branchId: 'branch-1' }),
      );
      manager.findOne.mockImplementation((entity: unknown) => {
        if (entity === PurchaseOrder)
          return Promise.resolve(
            buildPurchaseOrder({
              branchId: 'branch-1',
              warehouseId: 'wh-1',
            }),
          );
        if (entity === ProductVariant) return Promise.resolve(buildVariant());
        return Promise.resolve(null);
      });

      await expect(
        service.create('company-a', 'user-1', baseDto as never),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects receiving against a DRAFT purchase order (409)', async () => {
      manager.findOne.mockImplementation((entity: unknown) => {
        if (entity === PurchaseOrder)
          return Promise.resolve(
            buildPurchaseOrder({ status: PurchaseOrderStatus.Draft }),
          );
        return Promise.resolve(null);
      });

      await expect(
        service.create('company-a', 'user-1', baseDto as never),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('rejects receiving against a CANCELLED purchase order (409)', async () => {
      manager.findOne.mockImplementation((entity: unknown) => {
        if (entity === PurchaseOrder)
          return Promise.resolve(
            buildPurchaseOrder({ status: PurchaseOrderStatus.Cancelled }),
          );
        return Promise.resolve(null);
      });

      await expect(
        service.create('company-a', 'user-1', baseDto as never),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('rejects a nonexistent purchase order (404)', async () => {
      manager.findOne.mockImplementation((entity: unknown) => {
        if (entity === PurchaseOrder) return Promise.resolve(null);
        return Promise.resolve(null);
      });

      await expect(
        service.create('company-a', 'user-1', baseDto as never),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });

    it('rejects when productVariantId does not match the referenced PurchaseOrderItem', async () => {
      poiQueryBuilder.getOne.mockResolvedValue(
        buildPoi({ productVariantId: 'variant-other' }),
      );

      await expect(
        service.create('company-a', 'user-1', baseDto as never),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('allows receiving against a historical variant even if it was later archived or soft-deleted', async () => {
      manager.findOne.mockImplementation((entity: unknown) => {
        if (entity === PurchaseOrder)
          return Promise.resolve(buildPurchaseOrder());
        if (entity === ProductVariant)
          return Promise.resolve(
            buildVariant({
              status: ProductVariantStatus.Inactive,
              deletedAt: new Date(),
            }),
          );
        if (entity === WarehouseStock)
          return Promise.resolve(buildStock({ onHandQuantity: 5 }));
        return Promise.resolve(null);
      });

      const result = await service.create('company-a', 'user-1', baseDto);
      expect(result.receiptNumber).toMatch(/^GR-\d{4}-\d{6}$/);
    });

    it('rejects over-receiving beyond the remaining ordered quantity (409)', async () => {
      poiQueryBuilder.getOne.mockResolvedValue(buildPoi({ quantity: 10 }));
      sumQueryBuilder.getRawOne.mockResolvedValue({ total: '8' });
      // remaining = 10 - handled(8) = 2, but requesting 5

      await expect(
        service.create('company-a', 'user-1', baseDto as never),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('rejects when received + rejected exceeds the remaining quantity', async () => {
      poiQueryBuilder.getOne.mockResolvedValue(buildPoi({ quantity: 10 }));
      sumQueryBuilder.getRawOne.mockResolvedValue({ total: '8' });

      await expect(
        service.create('company-a', 'user-1', {
          ...baseDto,
          items: [
            {
              purchaseOrderItemId: 'poi-1',
              productVariantId: 'variant-1',
              receivedQuantity: 1,
              rejectedQuantity: 2,
            },
          ],
        } as never),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('rejects when neither received nor rejected quantity is provided', async () => {
      await expect(
        service.create('company-a', 'user-1', {
          ...baseDto,
          items: [
            {
              purchaseOrderItemId: 'poi-1',
              productVariantId: 'variant-1',
              receivedQuantity: 0,
              rejectedQuantity: 0,
            },
          ],
        } as never),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('accepts a reject-only line item without creating stock movement', async () => {
      const savedByEntity: Array<{
        entity: unknown;
        data: Record<string, unknown>;
      }> = [];
      manager.save.mockImplementation((entity: unknown, data: unknown) => {
        savedByEntity.push({ entity, data: data as Record<string, unknown> });
        return Promise.resolve(data);
      });

      const result = await service.create('company-a', 'user-1', {
        ...baseDto,
        items: [
          {
            purchaseOrderItemId: 'poi-1',
            productVariantId: 'variant-1',
            receivedQuantity: 0,
            rejectedQuantity: 5,
          },
        ],
      });

      expect(result.receiptNumber).toMatch(/^GR-\d{4}-\d{6}$/);
      expect(stockQueryBuilder.getOneOrFail).not.toHaveBeenCalled();
      const movement = savedByEntity.find(
        (s) =>
          (s.data as { movementType?: string }).movementType ===
          'PURCHASE_RECEIPT',
      );
      expect(movement).toBeUndefined();
    });

    it('treats prior rejected quantity as handled when computing remaining', async () => {
      poiQueryBuilder.getOne.mockResolvedValue(buildPoi({ quantity: 10 }));
      sumQueryBuilder.getRawOne.mockResolvedValue({ total: '8' });

      await expect(
        service.create('company-a', 'user-1', {
          ...baseDto,
          items: [
            {
              purchaseOrderItemId: 'poi-1',
              productVariantId: 'variant-1',
              receivedQuantity: 3,
              rejectedQuantity: 0,
            },
          ],
        } as never),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('blocks another reject-only receipt once a purchase-order line is fully handled', async () => {
      poiQueryBuilder.getOne.mockResolvedValue(buildPoi({ quantity: 5 }));
      sumQueryBuilder.getRawOne.mockResolvedValue({ total: '5' });

      await expect(
        service.create('company-a', 'user-1', {
          ...baseDto,
          items: [
            {
              purchaseOrderItemId: 'poi-1',
              productVariantId: 'variant-1',
              receivedQuantity: 0,
              rejectedQuantity: 1,
            },
          ],
        } as never),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('accepts an exact-final-receipt (receivedQuantity === remaining)', async () => {
      poiQueryBuilder.getOne.mockResolvedValue(buildPoi({ quantity: 5 }));
      sumQueryBuilder.getRawOne.mockResolvedValue({ total: '0' });

      const result = await service.create('company-a', 'user-1', baseDto);

      expect(result.receiptNumber).toMatch(/^GR-\d{4}-\d{6}$/);
    });

    it('increases WarehouseStock.onHandQuantity by the received quantity and locks the row', async () => {
      const stock = buildStock({ onHandQuantity: 5 });
      stockQueryBuilder.getOneOrFail.mockResolvedValue(stock);
      manager.findOneOrFail.mockImplementation((entity: unknown) => {
        if (entity === WarehouseStock) return Promise.resolve(stock);
        return Promise.resolve(null);
      });

      await service.create('company-a', 'user-1', baseDto);

      expect(stockQueryBuilder.setLock).toHaveBeenCalledWith(
        'pessimistic_write',
      );
      expect(stock.onHandQuantity).toBe(10); // 5 + 5
    });

    it('sets the movement type to PURCHASE_RECEIPT with correct quantityChange/quantityAfter', async () => {
      const stock = buildStock({ onHandQuantity: 5 });
      stockQueryBuilder.getOneOrFail.mockResolvedValue(stock);
      manager.findOneOrFail.mockImplementation((entity: unknown) => {
        if (entity === WarehouseStock) return Promise.resolve(stock);
        return Promise.resolve(null);
      });

      const savedByEntity: Array<{
        entity: unknown;
        data: Record<string, unknown>;
      }> = [];
      manager.save.mockImplementation((entity: unknown, data: unknown) => {
        savedByEntity.push({ entity, data: data as Record<string, unknown> });
        return Promise.resolve(data);
      });

      await service.create('company-a', 'user-1', baseDto);

      const movement = savedByEntity.find(
        (s) =>
          (s.data as { movementType?: string }).movementType ===
          'PURCHASE_RECEIPT',
      );
      expect(movement).toBeDefined();
      expect(movement?.data.quantityChange).toBe(5);
    });

    it('denormalizes supplierId from the PurchaseOrder onto the GoodsReceipt', async () => {
      const result = await service.create('company-a', 'user-1', baseDto);
      expect(result.supplierId).toBe('sup-1');
    });

    it('inherits the purchase-order line UOM snapshot and converts received quantity to base stock', async () => {
      const created: Record<string, unknown>[] = [];
      manager.create.mockImplementation(
        (_entity: unknown, data: Record<string, unknown>) => {
          created.push(data);
          return data;
        },
      );
      poiQueryBuilder.getOne.mockResolvedValue(
        buildPoi({
          quantity: 2,
          baseQuantitySnapshot: 24,
          conversionFactorToBaseSnapshot: '12.0000',
          uomId: 'uom-box',
          uomCodeSnapshot: 'BOX',
          uomNameSnapshot: 'Box',
        }),
      );
      const stock = buildStock({ onHandQuantity: 5 });
      stockQueryBuilder.getOneOrFail.mockResolvedValue(stock);
      manager.findOneOrFail.mockImplementation((entity: unknown) => {
        if (entity === WarehouseStock) {
          return Promise.resolve(buildStock({ onHandQuantity: 17 }));
        }
        return Promise.resolve(null);
      });

      await service.create('company-a', 'user-1', {
        ...baseDto,
        items: [
          {
            purchaseOrderItemId: 'poi-1',
            productVariantId: 'variant-1',
            receivedQuantity: 1,
          },
        ],
      });

      const receiptItemPayload = created.find((row) => row.uomId === 'uom-box');
      expect(receiptItemPayload).toMatchObject({
        uomId: 'uom-box',
        uomCodeSnapshot: 'BOX',
        receivedQuantity: 1,
        baseReceivedQuantity: 12,
        conversionFactorToBaseSnapshot: '12.0000',
      });
      expect(manager.update).toHaveBeenCalledWith(WarehouseStock, 'stock-1', {
        onHandQuantity: 17,
      });
    });
  });

  describe('findByIdInCompany — cross-company isolation', () => {
    it('throws NotFound for a goods receipt belonging to a different company', async () => {
      goodsReceiptRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findByIdInCompany('gr-1', 'company-b'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });
  });
});
