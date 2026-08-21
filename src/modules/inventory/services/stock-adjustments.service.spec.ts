import { EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import { StockAdjustmentsService } from './stock-adjustments.service';
import { StockAdjustment } from '../entities/stock-adjustment.entity';
import { StockAdjustmentReason } from '../entities/stock-adjustment-reason.enum';
import { WarehouseStock } from '../entities/warehouse-stock.entity';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { WarehousesService } from '../../organization/services/warehouses.service';
import { WarehouseStatus } from '../../organization/entities/warehouse-status.enum';
import { ProductVariantsService } from '../../products/services/product-variants.service';
import { ProductVariantStatus } from '../../products/entities/product-variant-status.enum';
import { ErrorCode } from '../../../core/errors/error-codes';
import { Warehouse } from '../../organization/entities/warehouse.entity';
import { ProductVariant } from '../../products/entities/product-variant.entity';
import { ProductVariantAttribute } from '../../products/entities/product-variant-attribute.entity';
import { User } from '../../users/entities/user.entity';
import { StockMovement } from '../entities/stock-movement.entity';

describe('StockAdjustmentsService', () => {
  let service: StockAdjustmentsService;
  let stockAdjustmentRepository: jest.Mocked<
    Pick<Repository<StockAdjustment>, 'findOne' | 'createQueryBuilder'>
  >;
  let warehouseRepository: jest.Mocked<Pick<Repository<Warehouse>, 'find'>>;
  let productVariantRepository: jest.Mocked<
    Pick<Repository<ProductVariant>, 'find'>
  >;
  let productVariantAttributeRepository: jest.Mocked<
    Pick<Repository<ProductVariantAttribute>, 'find'>
  >;
  let userRepository: jest.Mocked<Pick<Repository<User>, 'find'>>;
  let stockMovementRepository: jest.Mocked<Pick<Repository<StockMovement>, 'find'>>;
  let transactionService: jest.Mocked<Pick<TransactionService, 'run'>>;
  let warehousesService: jest.Mocked<Pick<WarehousesService, 'findById'>>;
  let productVariantsService: jest.Mocked<
    Pick<ProductVariantsService, 'findByIdInCompany'>
  >;
  let queryBuilder: jest.Mocked<
    Pick<
      SelectQueryBuilder<StockAdjustment>,
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
  let manager: MockManager;
  let stockRow: { onHandQuantity: number };
  let stockQueryBuilder: {
    where: jest.Mock;
    andWhere: jest.Mock;
    setLock: jest.Mock;
    getOneOrFail: jest.Mock;
  };

  const buildWarehouse = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'wh-1',
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
    stockAdjustmentRepository = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    warehouseRepository = {
      find: jest.fn().mockResolvedValue([]),
    };
    productVariantRepository = {
      find: jest.fn().mockResolvedValue([]),
    };
    productVariantAttributeRepository = {
      find: jest.fn().mockResolvedValue([]),
    };
    userRepository = {
      find: jest.fn().mockResolvedValue([]),
    };
    stockMovementRepository = {
      find: jest.fn().mockResolvedValue([]),
    };

    stockRow = { onHandQuantity: 10 };
    stockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOneOrFail: jest.fn(() => Promise.resolve(stockRow)),
    };

    manager = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((_entity: unknown, data: unknown) => data),
      save: jest.fn((_entity: unknown, data: unknown) => Promise.resolve(data)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      query: jest.fn(),
      createQueryBuilder: jest.fn((entity: unknown) => {
        if (entity === WarehouseStock) return stockQueryBuilder;
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
    productVariantsService = {
      findByIdInCompany: jest.fn().mockResolvedValue(buildVariant()),
    };

    service = new StockAdjustmentsService(
      stockAdjustmentRepository as unknown as Repository<StockAdjustment>,
      warehouseRepository as unknown as Repository<Warehouse>,
      productVariantRepository as unknown as Repository<ProductVariant>,
      productVariantAttributeRepository as unknown as Repository<ProductVariantAttribute>,
      userRepository as unknown as Repository<User>,
      stockMovementRepository as unknown as Repository<StockMovement>,
      transactionService as unknown as TransactionService,
      warehousesService as unknown as WarehousesService,
      productVariantsService as unknown as ProductVariantsService,
    );
  });

  const baseDto = {
    warehouseId: 'wh-1',
    productVariantId: 'variant-1',
    quantityChange: 5,
    reason: StockAdjustmentReason.Found,
  };

  describe('create', () => {
    it('rejects quantityChange === 0 (400)', async () => {
      await expect(
        service.create('company-a', 'user-1', {
          ...baseDto,
          quantityChange: 0,
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('increases stock for a positive quantityChange with no restriction', async () => {
      const result = await service.create('company-a', 'user-1', baseDto);

      expect(stockRow.onHandQuantity).toBe(15); // 10 + 5
      expect(result.adjustmentNumber).toMatch(/^ADJ-\d{4}-\d{6}$/);
    });

    it('decreases stock for a negative quantityChange when sufficient', async () => {
      await service.create('company-a', 'user-1', {
        ...baseDto,
        quantityChange: -4,
      });

      expect(stockRow.onHandQuantity).toBe(6); // 10 - 4
    });

    it('rejects a negative quantityChange that would drive on-hand quantity below zero (409)', async () => {
      stockRow.onHandQuantity = 2;

      await expect(
        service.create('company-a', 'user-1', {
          ...baseDto,
          quantityChange: -5,
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('rejects an inactive warehouse', async () => {
      warehousesService.findById.mockResolvedValue(
        buildWarehouse({ status: WarehouseStatus.Inactive }),
      );

      await expect(
        service.create('company-a', 'user-1', baseDto as never),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects an inactive product variant', async () => {
      productVariantsService.findByIdInCompany.mockResolvedValue(
        buildVariant({ status: ProductVariantStatus.Inactive }),
      );

      await expect(
        service.create('company-a', 'user-1', baseDto as never),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('writes movement type OPENING_BALANCE when reason is OPENING_BALANCE', async () => {
      const saved: Record<string, unknown>[] = [];
      manager.save.mockImplementation((_entity: unknown, data: unknown) => {
        saved.push(data as Record<string, unknown>);
        return Promise.resolve(data);
      });

      await service.create('company-a', 'user-1', {
        ...baseDto,
        reason: StockAdjustmentReason.OpeningBalance,
      });

      const movement = saved.find((s) => 'movementType' in s);
      expect(movement?.movementType).toBe('OPENING_BALANCE');
    });

    it('writes movement type ADJUSTMENT for any non-opening-balance reason', async () => {
      const saved: Record<string, unknown>[] = [];
      manager.save.mockImplementation((_entity: unknown, data: unknown) => {
        saved.push(data as Record<string, unknown>);
        return Promise.resolve(data);
      });

      await service.create('company-a', 'user-1', {
        ...baseDto,
        reason: StockAdjustmentReason.Damage,
        quantityChange: -1,
      });

      const movement = saved.find((s) => 'movementType' in s);
      expect(movement?.movementType).toBe('ADJUSTMENT');
    });

    it('quantityAfter on the movement reflects the post-adjustment on-hand quantity', async () => {
      const saved: Record<string, unknown>[] = [];
      manager.save.mockImplementation((_entity: unknown, data: unknown) => {
        saved.push(data as Record<string, unknown>);
        return Promise.resolve(data);
      });

      await service.create('company-a', 'user-1', baseDto);

      const movement = saved.find((s) => 'movementType' in s);
      expect(movement?.quantityAfter).toBe(15);
    });
  });

  describe('findByIdInCompany — cross-company isolation', () => {
    it('throws NotFound for a stock adjustment belonging to a different company', async () => {
      stockAdjustmentRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findByIdInCompany('sa-1', 'company-b'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });
  });
});
