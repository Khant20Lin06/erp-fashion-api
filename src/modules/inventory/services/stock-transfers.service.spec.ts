import { EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import { StockTransfersService } from './stock-transfers.service';
import { StockTransfer } from '../entities/stock-transfer.entity';
import { StockTransferItem } from '../entities/stock-transfer-item.entity';
import { WarehouseStock } from '../entities/warehouse-stock.entity';
import { ProductVariant } from '../../products/entities/product-variant.entity';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { WarehousesService } from '../../organization/services/warehouses.service';
import { WarehouseStatus } from '../../organization/entities/warehouse-status.enum';
import { ProductVariantStatus } from '../../products/entities/product-variant-status.enum';
import { ErrorCode } from '../../../core/errors/error-codes';
import { Warehouse } from '../../organization/entities/warehouse.entity';
import { User } from '../../users/entities/user.entity';
import { ProductVariantAttribute } from '../../products/entities/product-variant-attribute.entity';

describe('StockTransfersService', () => {
  let service: StockTransfersService;
  let stockTransferRepository: jest.Mocked<
    Pick<Repository<StockTransfer>, 'findOne' | 'createQueryBuilder'>
  >;
  let stockTransferItemRepository: jest.Mocked<
    Pick<Repository<StockTransferItem>, 'find'>
  >;
  let warehouseRepository: jest.Mocked<Pick<Repository<Warehouse>, 'find'>>;
  let userRepository: jest.Mocked<Pick<Repository<User>, 'find'>>;
  let productVariantRepository: jest.Mocked<
    Pick<Repository<ProductVariant>, 'find'>
  >;
  let productVariantAttributeRepository: jest.Mocked<
    Pick<Repository<ProductVariantAttribute>, 'find'>
  >;
  let transactionService: jest.Mocked<Pick<TransactionService, 'run'>>;
  let warehousesService: jest.Mocked<Pick<WarehousesService, 'findById'>>;
  let queryBuilder: jest.Mocked<
    Pick<
      SelectQueryBuilder<StockTransfer>,
      'where' | 'andWhere' | 'orderBy' | 'skip' | 'take' | 'getManyAndCount'
    >
  >;

  interface MockManager {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    query: jest.Mock;
    createQueryBuilder: jest.Mock;
  }
  interface LockingQueryBuilder {
    where: jest.Mock;
    andWhere: jest.Mock;
    setLock: jest.Mock;
    getOneOrFail: jest.Mock;
  }
  let manager: MockManager;
  const stockRows = new Map<string, { onHandQuantity: number }>();
  let stockLockOrder: string[];

  const buildWarehouse = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'wh-src',
      companyId: 'company-a',
      status: WarehouseStatus.Active,
      ...overrides,
    }) as never;

  const buildVariant = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'variant-1',
      companyId: 'company-a',
      status: ProductVariantStatus.Active,
      ...overrides,
    }) as never;

  beforeEach(() => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };
    stockTransferRepository = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    stockTransferItemRepository = {
      find: jest.fn().mockResolvedValue([]),
    };
    warehouseRepository = {
      find: jest.fn().mockResolvedValue([]),
    };
    userRepository = {
      find: jest.fn().mockResolvedValue([]),
    };
    productVariantRepository = {
      find: jest.fn().mockResolvedValue([]),
    };
    productVariantAttributeRepository = {
      find: jest.fn().mockResolvedValue([]),
    };

    stockRows.clear();
    stockRows.set('wh-src:variant-1', { onHandQuantity: 10 });
    stockLockOrder = [];

    manager = {
      findOne: jest.fn((entity: unknown) => {
        if (entity === ProductVariant) return Promise.resolve(buildVariant());
        return Promise.resolve(null);
      }),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((_entity: unknown, data: unknown) => data),
      save: jest.fn((_entity: unknown, data: unknown) => Promise.resolve(data)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      query: jest.fn(),
      createQueryBuilder: jest.fn((entity: unknown): LockingQueryBuilder => {
        if (entity === WarehouseStock) {
          const state: { warehouseId?: string; variantId?: string } = {};
          const captureCondition = (
            cond: string,
            params: Record<string, string>,
          ): void => {
            if (cond.includes('warehouseId'))
              state.warehouseId = params.warehouseId;
            if (cond.includes('productVariantId'))
              state.variantId = params.productVariantId;
          };
          const qb: LockingQueryBuilder = {
            where: jest.fn((cond: string, params: Record<string, string>) => {
              captureCondition(cond, params);
              return qb;
            }),
            andWhere: jest.fn(
              (cond: string, params: Record<string, string>) => {
                captureCondition(cond, params);
                return qb;
              },
            ),
            setLock: jest.fn(() => qb),
            getOneOrFail: jest.fn(() => {
              const key = `${state.warehouseId}:${state.variantId}`;
              stockLockOrder.push(key);
              if (!stockRows.has(key)) {
                stockRows.set(key, { onHandQuantity: 0 });
              }
              // Return the SAME object reference stored in stockRows so
              // in-place mutations (stock.onHandQuantity -= ...) persist
              // across the (single-per-test) mock, mirroring how a real
              // locked row's mutation would be visible to a later save().
              const row = stockRows.get(key)!;
              return Promise.resolve({
                id: key,
                warehouseId: state.warehouseId,
                productVariantId: state.variantId,
                get onHandQuantity() {
                  return row.onHandQuantity;
                },
                set onHandQuantity(value: number) {
                  row.onHandQuantity = value;
                },
              });
            }),
          };
          return qb;
        }
        // Counter path
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
      findById: jest.fn((id: string) =>
        Promise.resolve(
          id === 'wh-src'
            ? buildWarehouse({ id: 'wh-src' })
            : buildWarehouse({ id: 'wh-dst' }),
        ),
      ),
    };

    service = new StockTransfersService(
      stockTransferRepository as unknown as Repository<StockTransfer>,
      stockTransferItemRepository as unknown as Repository<StockTransferItem>,
      warehouseRepository as unknown as Repository<Warehouse>,
      userRepository as unknown as Repository<User>,
      productVariantRepository as unknown as Repository<ProductVariant>,
      productVariantAttributeRepository as unknown as Repository<ProductVariantAttribute>,
      transactionService as unknown as TransactionService,
      warehousesService as unknown as WarehousesService,
    );
  });

  const baseDto = {
    sourceWarehouseId: 'wh-src',
    destinationWarehouseId: 'wh-dst',
    items: [{ productVariantId: 'variant-1', quantity: 3 }],
  };

  describe('create', () => {
    it('rejects source === destination (400)', async () => {
      await expect(
        service.create('company-a', 'user-1', {
          ...baseDto,
          destinationWarehouseId: 'wh-src',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects an inactive source warehouse', async () => {
      warehousesService.findById.mockImplementation((id: string) =>
        Promise.resolve(
          id === 'wh-src'
            ? buildWarehouse({ id: 'wh-src', status: WarehouseStatus.Inactive })
            : buildWarehouse({ id: 'wh-dst' }),
        ),
      );

      await expect(
        service.create('company-a', 'user-1', baseDto as never),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects a cross-company destination warehouse', async () => {
      warehousesService.findById.mockImplementation((id: string) =>
        Promise.resolve(
          id === 'wh-src'
            ? buildWarehouse({ id: 'wh-src' })
            : buildWarehouse({ id: 'wh-dst', companyId: 'company-b' }),
        ),
      );

      await expect(
        service.create('company-a', 'user-1', baseDto as never),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects insufficient source stock (409)', async () => {
      stockRows.set('wh-src:variant-1', { onHandQuantity: 1 });

      await expect(
        service.create('company-a', 'user-1', baseDto as never),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('decreases source and increases destination onHandQuantity by the transferred amount', async () => {
      const result = await service.create('company-a', 'user-1', baseDto);

      expect(stockRows.get('wh-src:variant-1')?.onHandQuantity).toBe(7); // 10 - 3
      expect(stockRows.get('wh-dst:variant-1')?.onHandQuantity).toBe(3); // 0 + 3
      expect(result.transferNumber).toMatch(/^TRF-\d{4}-\d{6}$/);
    });

    it('locks WarehouseStock rows in deterministic (warehouseId, productVariantId) order', async () => {
      await service.create('company-a', 'user-1', baseDto);

      // wh-dst < wh-src lexicographically ("d" < "s"), so destination locks first.
      expect(stockLockOrder).toEqual(['wh-dst:variant-1', 'wh-src:variant-1']);
    });

    it('creates the destination WarehouseStock row via upsert when it does not exist yet', async () => {
      expect(stockRows.has('wh-dst:variant-1')).toBe(false);
      await service.create('company-a', 'user-1', baseDto);
      expect(stockRows.has('wh-dst:variant-1')).toBe(true);
    });

    it('writes one TRANSFER_OUT and one TRANSFER_IN movement per item', async () => {
      const saved: Record<string, unknown>[] = [];
      manager.save.mockImplementation((_entity: unknown, data: unknown) => {
        saved.push(data as Record<string, unknown>);
        return Promise.resolve(data);
      });

      await service.create('company-a', 'user-1', baseDto);

      const outMovements = saved.filter(
        (s) => s.movementType === 'TRANSFER_OUT',
      );
      const inMovements = saved.filter((s) => s.movementType === 'TRANSFER_IN');
      expect(outMovements).toHaveLength(1);
      expect(inMovements).toHaveLength(1);
      expect(outMovements[0]?.quantityChange).toBe(-3);
      expect(inMovements[0]?.quantityChange).toBe(3);
    });

    it('rejects an inactive product variant', async () => {
      manager.findOne.mockImplementation((entity: unknown) => {
        if (entity === ProductVariant)
          return Promise.resolve(
            buildVariant({ status: ProductVariantStatus.Inactive }),
          );
        return Promise.resolve(null);
      });

      await expect(
        service.create('company-a', 'user-1', baseDto as never),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });
  });

  describe('findByIdInCompany — cross-company isolation', () => {
    it('throws NotFound for a stock transfer belonging to a different company', async () => {
      stockTransferRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findByIdInCompany('st-1', 'company-b'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });
  });
});
