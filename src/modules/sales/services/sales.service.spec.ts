import { EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import { SalesService } from './sales.service';
import { Sale } from '../entities/sale.entity';
import { SaleItem } from '../entities/sale-item.entity';
import { SaleStatus } from '../entities/sale-status.enum';
import { SaleFulfillmentStatus } from '../entities/sale-fulfillment-status.enum';
import { CompanySaleCounter } from '../entities/company-sale-counter.entity';
import { WarehouseStock } from '../../inventory/entities/warehouse-stock.entity';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { CompaniesService } from '../../organization/services/companies.service';
import { BranchesService } from '../../organization/services/branches.service';
import { WarehousesService } from '../../organization/services/warehouses.service';
import { WarehouseStatus } from '../../organization/entities/warehouse-status.enum';
import { CustomersService } from '../../customer-supplier/services/customers.service';
import { CustomerStatus } from '../../customer-supplier/entities/customer-status.enum';
import { ProductVariantsService } from '../../products/services/product-variants.service';
import { ProductVariantUomsService } from '../../products/services/product-variant-uoms.service';
import { PriceListItemsService } from '../../products/services/price-list-items.service';
import { PriceList } from '../../products/entities/price-list.entity';
import { ProductVariantStatus } from '../../products/entities/product-variant-status.enum';
import { PriceListStatus } from '../../products/entities/price-list-status.enum';
import { SalesAccountStatus } from '../../sales-accounts/entities/sales-account-status.enum';
import { SalesAccountAccessService } from '../../sales-accounts/services/sales-account-access.service';
import { CompanyStatus } from '../../organization/entities/company-status.enum';
import { ErrorCode } from '../../../core/errors/error-codes';
import { LoyaltyService } from '../../loyalty/services/loyalty.service';
import { PromotionsService } from '../../promotions/services/promotions.service';
import { ProductVariantUomUsageType } from '../../products/entities/product-variant-uom-usage-type.enum';

describe('SalesService', () => {
  let service: SalesService;
  let saleRepository: jest.Mocked<
    Pick<Repository<Sale>, 'findOne' | 'save' | 'createQueryBuilder'>
  >;
  let transactionService: jest.Mocked<Pick<TransactionService, 'run'>>;
  let companiesService: jest.Mocked<
    Pick<CompaniesService, 'findActiveByIdOrNull'>
  >;
  let branchesService: jest.Mocked<
    Pick<BranchesService, 'findActiveByIdOrNull'>
  >;
  let warehousesService: jest.Mocked<Pick<WarehousesService, 'findById'>>;
  let customersService: jest.Mocked<
    Pick<CustomersService, 'findByIdInCompany'>
  >;
  let productVariantsService: jest.Mocked<
    Pick<ProductVariantsService, 'findByIdInCompany'>
  >;
  let productVariantUomsService: jest.Mocked<
    Pick<ProductVariantUomsService, 'resolveSelectionForUsage'>
  >;
  let priceListItemsService: jest.Mocked<
    Pick<PriceListItemsService, 'resolveActivePrice'>
  >;
  let salesAccountAccessService: jest.Mocked<
    Pick<SalesAccountAccessService, 'canAccessSalesAccount'>
  >;
  let loyaltyService: jest.Mocked<Pick<LoyaltyService, 'earnForSale'>>;
  let promotionsService: jest.Mocked<
    Pick<
      PromotionsService,
      'resolveAndLockForUse' | 'computeDiscountAmount' | 'incrementUsage'
    >
  >;
  let queryBuilder: jest.Mocked<
    Pick<
      SelectQueryBuilder<Sale>,
      'where' | 'andWhere' | 'orderBy' | 'skip' | 'take' | 'getManyAndCount'
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
  let managerQueryBuilder: {
    where: jest.Mock;
    andWhere: jest.Mock;
    setLock: jest.Mock;
    getOneOrFail: jest.Mock;
  };

  const buildCompany = () =>
    ({ id: 'company-a', status: CompanyStatus.Active }) as never;
  const buildCustomer = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'cust-1',
      companyId: 'company-a',
      status: CustomerStatus.Active,
      ...overrides,
    }) as never;
  const buildVariant = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'variant-1',
      companyId: 'company-a',
      sku: 'SKU-1',
      status: ProductVariantStatus.Active,
      product: { name: 'Test Product' },
      ...overrides,
    }) as never;
  const buildPriceList = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'pl-1',
      companyId: 'company-a',
      status: PriceListStatus.Active,
      ...overrides,
    }) as never;
  const buildPriceListItem = (overrides: Record<string, unknown> = {}) =>
    ({ id: 'pli-1', price: '100.00', status: 'ACTIVE', ...overrides }) as never;
  const buildCounter = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'counter-1',
      companyId: 'company-a',
      year: 2026,
      lastSequence: 0,
      ...overrides,
    }) as CompanySaleCounter;

  beforeEach(() => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };
    saleRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };

    managerQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOneOrFail: jest.fn(),
    };
    manager = {
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      find: jest.fn(),
      create: jest.fn((_entity: unknown, data: unknown) => data),
      save: jest.fn((_entity: unknown, data: unknown) => Promise.resolve(data)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      query: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(managerQueryBuilder),
    };

    transactionService = {
      run: jest
        .fn()
        .mockImplementation((work: (m: EntityManager) => Promise<unknown>) =>
          work(manager as unknown as EntityManager),
        ),
    };
    companiesService = { findActiveByIdOrNull: jest.fn() };
    branchesService = { findActiveByIdOrNull: jest.fn() };
    warehousesService = { findById: jest.fn() };
    customersService = { findByIdInCompany: jest.fn() };
    productVariantsService = { findByIdInCompany: jest.fn() };
    productVariantUomsService = {
      resolveSelectionForUsage: jest.fn().mockResolvedValue(null),
    };
    priceListItemsService = {
      resolveActivePrice: jest.fn().mockResolvedValue(buildPriceListItem()),
    };
    salesAccountAccessService = { canAccessSalesAccount: jest.fn() };
    loyaltyService = { earnForSale: jest.fn().mockResolvedValue(null) };
    promotionsService = {
      resolveAndLockForUse: jest.fn(),
      computeDiscountAmount: jest.fn(),
      incrementUsage: jest.fn().mockResolvedValue(undefined),
    };

    service = new SalesService(
      saleRepository as unknown as Repository<Sale>,
      transactionService as unknown as TransactionService,
      companiesService as unknown as CompaniesService,
      branchesService as unknown as BranchesService,
      warehousesService as unknown as WarehousesService,
      customersService as unknown as CustomersService,
      productVariantsService as unknown as ProductVariantsService,
      productVariantUomsService as unknown as ProductVariantUomsService,
      priceListItemsService as unknown as PriceListItemsService,
      salesAccountAccessService as unknown as SalesAccountAccessService,
      loyaltyService as unknown as LoyaltyService,
      promotionsService as unknown as PromotionsService,
    );
  });

  describe('create', () => {
    const baseDto = {
      customerId: 'cust-1',
      currency: 'USD',
      items: [{ productVariantId: 'variant-1', quantity: 2 }],
    };

    it('returns the original sale on an idempotent replay before looking up changed catalog data', async () => {
      const original = {
        id: 'existing',
        companyId: 'company-a',
        creationKey: 'key',
        creationHash: 'hash',
        items: [],
      } as unknown as Sale;
      saleRepository.findOne.mockResolvedValue(original);
      const result = await service.create('company-a', 'user-1', baseDto, {
        key: 'key',
        hash: 'hash',
      });
      expect(result.id).toBe('existing');
      expect(transactionService.run).not.toHaveBeenCalled();
      expect(productVariantsService.findByIdInCompany).not.toHaveBeenCalled();
    });

    it('rejects reuse of an idempotency key with a changed request', async () => {
      saleRepository.findOne.mockResolvedValue({
        creationHash: 'old',
      } as unknown as Sale);
      await expect(
        service.create('company-a', 'user-1', baseDto, {
          key: 'key',
          hash: 'new',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
      expect(transactionService.run).not.toHaveBeenCalled();
    });

    beforeEach(() => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      customersService.findByIdInCompany.mockResolvedValue(buildCustomer());
      productVariantsService.findByIdInCompany.mockResolvedValue(
        buildVariant(),
      );
      manager.findOneOrFail.mockResolvedValue(buildVariant());
      manager.find.mockImplementation((entity: unknown) => {
        if (entity === PriceList) {
          return Promise.resolve([buildPriceList()]);
        }
        if (entity === SaleItem) {
          return Promise.resolve([
            {
              id: 'sale-item-1',
              saleId: 'sale-1',
              productVariantId: 'variant-1',
              uomId: null,
              uomCodeSnapshot: null,
              uomNameSnapshot: null,
              quantity: 2,
              baseQuantitySnapshot: 2,
              conversionFactorToBaseSnapshot: '1.0000',
              unitPriceSnapshot: '100.00',
              discountSnapshot: '0.00',
              taxSnapshot: '0.00',
              lineTotal: '200.00',
              productNameSnapshot: 'Test Product',
              skuSnapshot: 'SKU-1',
            },
          ]);
        }
        return Promise.resolve([]);
      });
      manager.findOne.mockResolvedValue(null);
      managerQueryBuilder.getOneOrFail.mockResolvedValue(buildCounter());
    });

    it('rejects when companyId does not reference an active company', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(null);

      await expect(
        service.create('missing-co', 'user-1', baseDto as never),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects a nonexistent/inactive productVariant before starting the transaction', async () => {
      productVariantsService.findByIdInCompany.mockResolvedValue(
        buildVariant({ status: ProductVariantStatus.Inactive }),
      );

      await expect(
        service.create('company-a', 'user-1', baseDto as never),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
      expect(transactionService.run).not.toHaveBeenCalled();
    });

    it('rejects a branchId belonging to a different company', async () => {
      branchesService.findActiveByIdOrNull.mockResolvedValue({
        id: 'branch-1',
        companyId: 'company-b',
      } as never);

      await expect(
        service.create('company-a', 'user-1', {
          ...baseDto,
          branchId: 'branch-1',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects a warehouseId belonging to a different branch when both are supplied', async () => {
      branchesService.findActiveByIdOrNull.mockResolvedValue({
        id: 'branch-1',
        companyId: 'company-a',
      } as never);
      warehousesService.findById.mockResolvedValue({
        id: 'wh-1',
        companyId: 'company-a',
        branchId: 'branch-other',
        status: WarehouseStatus.Active,
      } as never);

      await expect(
        service.create('company-a', 'user-1', {
          ...baseDto,
          branchId: 'branch-1',
          warehouseId: 'wh-1',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('generates a sale number using the locked counter and computes totals server-side, ignoring any client-supplied totals', async () => {
      const created: Record<string, unknown>[] = [];
      manager.create.mockImplementation(
        (_entity: unknown, data: Record<string, unknown>) => {
          created.push(data);
          return data;
        },
      );

      const result = await service.create('company-a', 'user-1', {
        ...baseDto,
        // client-manipulated financial fields — must be ignored entirely
        subtotal: '999999.99',
        grandTotal: '999999.99',
      } as never);

      expect(managerQueryBuilder.setLock).toHaveBeenCalledWith(
        'pessimistic_write',
      );
      expect(result.saleNumber).toMatch(/^SAL-\d{4}-\d{6}$/);
      // unit price 100.00 * qty 2 = 200.00, no discount/tax
      expect(result.subtotal).toBe('200.00');
      expect(result.grandTotal).toBe('200.00');
      expect(result.balanceAmount).toBe('200.00');
      expect(result.paidAmount).toBe('0.00');
      expect(result.status).toBe(SaleStatus.Draft);
    });

    it('validates a supplied SalesAccount belongs to the company and the user is authorized', async () => {
      manager.findOne.mockImplementation((entity: unknown) => {
        const name = (entity as { name?: string }).name;
        if (name === 'SalesAccount') {
          return Promise.resolve({
            id: 'sa-1',
            companyId: 'company-a',
            status: SalesAccountStatus.Active,
          });
        }
        if (name === 'PriceListItem')
          return Promise.resolve(buildPriceListItem());
        return Promise.resolve(null);
      });
      salesAccountAccessService.canAccessSalesAccount.mockResolvedValue(true);

      const result = await service.create('company-a', 'user-1', {
        ...baseDto,
        salesAccountId: 'sa-1',
      });

      expect(
        salesAccountAccessService.canAccessSalesAccount,
      ).toHaveBeenCalledWith('user-1', 'sa-1');
      expect(result.salesAccountId).toBe('sa-1');
    });

    it('rejects a cross-company SalesAccount as not found (404)', async () => {
      manager.findOne.mockImplementation((entity: unknown) => {
        const name = (entity as { name?: string }).name;
        if (name === 'SalesAccount') {
          return Promise.resolve({
            id: 'sa-1',
            companyId: 'company-b',
            status: SalesAccountStatus.Active,
          });
        }
        if (name === 'PriceListItem')
          return Promise.resolve(buildPriceListItem());
        return Promise.resolve(null);
      });

      await expect(
        service.create('company-a', 'user-1', {
          ...baseDto,
          salesAccountId: 'sa-1',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });

    it('rejects an unauthorized-but-existing SalesAccount as forbidden (403)', async () => {
      manager.findOne.mockImplementation((entity: unknown) => {
        const name = (entity as { name?: string }).name;
        if (name === 'SalesAccount') {
          return Promise.resolve({
            id: 'sa-1',
            companyId: 'company-a',
            status: SalesAccountStatus.Active,
          });
        }
        if (name === 'PriceListItem')
          return Promise.resolve(buildPriceListItem());
        return Promise.resolve(null);
      });
      salesAccountAccessService.canAccessSalesAccount.mockResolvedValue(false);

      await expect(
        service.create('company-a', 'user-1', {
          ...baseDto,
          salesAccountId: 'sa-1',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Forbidden });
    });

    it('rejects when no active price is found for the resolved price list', async () => {
      priceListItemsService.resolveActivePrice.mockResolvedValue(null);

      await expect(
        service.create('company-a', 'user-1', baseDto as never),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects when the company has zero/multiple active price lists and no priceListId was supplied', async () => {
      manager.find.mockResolvedValue([
        buildPriceList(),
        buildPriceList({ id: 'pl-2' }),
      ]);

      await expect(
        service.create('company-a', 'user-1', baseDto as never),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects a per-line discount that exceeds the line subtotal', async () => {
      await expect(
        service.create('company-a', 'user-1', {
          ...baseDto,
          items: [
            {
              productVariantId: 'variant-1',
              quantity: 1,
              discountAmount: '999.00',
            },
          ],
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('includes a validated per-line taxAmount pass-through in the server-computed total', async () => {
      const result = await service.create('company-a', 'user-1', {
        ...baseDto,
        items: [
          { productVariantId: 'variant-1', quantity: 1, taxAmount: '10.00' },
        ],
      });

      // unitPrice 100.00 * qty 1 + tax 10.00 = 110.00
      expect(result.grandTotal).toBe('110.00');
      expect(result.taxAmount).toBe('10.00');
    });

    it('resolves UOM-specific pricing and snapshots the converted base quantity', async () => {
      const created: Record<string, unknown>[] = [];
      manager.create.mockImplementation(
        (_entity: unknown, data: Record<string, unknown>) => {
          created.push(data);
          return data;
        },
      );
      productVariantUomsService.resolveSelectionForUsage.mockResolvedValue({
        uomId: 'uom-box',
        code: 'BOX',
        name: 'Box',
        symbol: null,
        conversionFactorToBase: '12.0000',
        usageType: ProductVariantUomUsageType.Sales,
        isBase: false,
      });
      priceListItemsService.resolveActivePrice.mockResolvedValue(
        buildPriceListItem({ price: '1200.00', uomId: 'uom-box' }),
      );

      await service.create('company-a', 'user-1', {
        ...baseDto,
        items: [
          { productVariantId: 'variant-1', uomId: 'uom-box', quantity: 2 },
        ],
      });

      expect(priceListItemsService.resolveActivePrice).toHaveBeenCalledWith(
        'company-a',
        'pl-1',
        'variant-1',
        'uom-box',
        expect.any(Date),
      );
      const saleItemPayload = created.find((row) => row.uomId === 'uom-box');
      expect(saleItemPayload).toMatchObject({
        uomId: 'uom-box',
        uomCodeSnapshot: 'BOX',
        quantity: 2,
        baseQuantitySnapshot: 24,
        conversionFactorToBaseSnapshot: '12.0000',
      });
    });
  });

  describe('confirm / cancel — lifecycle transitions', () => {
    const buildSale = (overrides: Record<string, unknown> = {}) =>
      ({
        id: 'sale-1',
        companyId: 'company-a',
        status: SaleStatus.Draft,
        warehouseId: 'wh-1',
        items: [{ productVariantId: 'variant-1', quantity: 2 }],
        ...overrides,
      }) as Sale;

    const buildStock = (overrides: Record<string, unknown> = {}) =>
      ({
        id: 'stock-1',
        warehouseId: 'wh-1',
        productVariantId: 'variant-1',
        onHandQuantity: 10,
        reservedQuantity: 0,
        ...overrides,
      }) as never;

    it('allows DRAFT -> CONFIRMED and deducts stock (Phase 14 D5)', async () => {
      saleRepository.findOne.mockResolvedValue(buildSale());
      managerQueryBuilder.getOneOrFail.mockResolvedValue(buildStock());
      manager.save.mockImplementation((_entity: unknown, data: unknown) =>
        Promise.resolve(data),
      );

      const result = await service.confirm('sale-1', 'company-a', 'user-1');

      expect(result.status).toBe(SaleStatus.Confirmed);
      expect(managerQueryBuilder.setLock).toHaveBeenCalledWith(
        'pessimistic_write',
      );
    });

    it('deducts stock using baseQuantitySnapshot when the sale line was entered in an alternate UOM', async () => {
      saleRepository.findOne.mockResolvedValue(
        buildSale({
          items: [
            {
              productVariantId: 'variant-1',
              quantity: 2,
              baseQuantitySnapshot: 24,
            },
          ],
        }),
      );
      managerQueryBuilder.getOneOrFail.mockResolvedValue(
        buildStock({ onHandQuantity: 30 }),
      );

      await service.confirm('sale-1', 'company-a', 'user-1');

      expect(manager.update).toHaveBeenCalledWith(WarehouseStock, 'stock-1', {
        onHandQuantity: 6,
      });
    });

    it('rejects confirmation when Sale.warehouseId is null (stock issue requires a warehouse)', async () => {
      saleRepository.findOne.mockResolvedValue(
        buildSale({ warehouseId: null }),
      );

      await expect(
        service.confirm('sale-1', 'company-a', 'user-1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
      expect(transactionService.run).not.toHaveBeenCalled();
    });

    it('rejects confirmation with 409 and performs no stock mutation when onHandQuantity is insufficient for an item', async () => {
      saleRepository.findOne.mockResolvedValue(buildSale());
      managerQueryBuilder.getOneOrFail.mockResolvedValue(
        buildStock({ onHandQuantity: 1 }),
      );

      await expect(
        service.confirm('sale-1', 'company-a', 'user-1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('rolls back the whole confirmation atomically when one of multiple items is insufficient', async () => {
      saleRepository.findOne.mockResolvedValue(
        buildSale({
          items: [
            { productVariantId: 'variant-1', quantity: 2 },
            { productVariantId: 'variant-2', quantity: 100 },
          ],
        }),
      );
      managerQueryBuilder.getOneOrFail.mockImplementation(() => {
        // First lock call resolves variant-1 (sufficient), second resolves
        // variant-2 (insufficient) — both are locked before either is
        // validated, proving all-or-nothing behavior.
        const callIndex = managerQueryBuilder.getOneOrFail.mock.calls.length;
        return Promise.resolve(
          callIndex === 1
            ? buildStock({ productVariantId: 'variant-1', onHandQuantity: 10 })
            : buildStock({
                productVariantId: 'variant-2',
                onHandQuantity: 5,
              }),
        );
      });

      await expect(
        service.confirm('sale-1', 'company-a', 'user-1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('allows DRAFT -> CANCELLED (no stock mutation, unchanged from Phase 12)', async () => {
      saleRepository.findOne.mockResolvedValue(buildSale());
      saleRepository.save.mockImplementation((input) =>
        Promise.resolve(input as Sale),
      );

      const result = await service.cancel('sale-1', 'company-a', 'user-1');

      expect(result.status).toBe(SaleStatus.Cancelled);
      expect(transactionService.run).not.toHaveBeenCalled();
    });

    it('rejects CONFIRMED -> CANCELLED with a 409 conflict', async () => {
      saleRepository.findOne.mockResolvedValue(
        buildSale({ status: SaleStatus.Confirmed }),
      );

      await expect(
        service.cancel('sale-1', 'company-a', 'user-1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('rejects CONFIRMED -> DRAFT-equivalent re-confirm with a 409 conflict', async () => {
      saleRepository.findOne.mockResolvedValue(
        buildSale({ status: SaleStatus.Confirmed }),
      );

      await expect(
        service.confirm('sale-1', 'company-a', 'user-1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('rejects CANCELLED -> CONFIRMED with a 409 conflict', async () => {
      saleRepository.findOne.mockResolvedValue(
        buildSale({ status: SaleStatus.Cancelled }),
      );

      await expect(
        service.confirm('sale-1', 'company-a', 'user-1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('rejects CANCELLED -> CANCELLED (no-op re-cancel) with a 409 conflict', async () => {
      saleRepository.findOne.mockResolvedValue(
        buildSale({ status: SaleStatus.Cancelled }),
      );

      await expect(
        service.cancel('sale-1', 'company-a', 'user-1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('confirm() sets fulfillmentStatus to PENDING_SHIPMENT alongside CONFIRMED', async () => {
      saleRepository.findOne.mockResolvedValue(buildSale());
      managerQueryBuilder.getOneOrFail.mockResolvedValue(buildStock());
      manager.save.mockImplementation((_entity: unknown, data: unknown) =>
        Promise.resolve(data),
      );

      const result = await service.confirm('sale-1', 'company-a', 'user-1');

      expect(result.fulfillmentStatus).toBe(
        SaleFulfillmentStatus.PendingShipment,
      );
    });
  });

  describe('ship / deliver — fulfillment tracking', () => {
    const buildConfirmedSale = (overrides: Record<string, unknown> = {}) =>
      ({
        id: 'sale-1',
        companyId: 'company-a',
        status: SaleStatus.Confirmed,
        fulfillmentStatus: SaleFulfillmentStatus.PendingShipment,
        ...overrides,
      }) as Sale;

    it('allows PENDING_SHIPMENT -> SHIPPED and stamps shippedAt', async () => {
      saleRepository.findOne.mockResolvedValue(buildConfirmedSale());
      saleRepository.save.mockImplementation((input) =>
        Promise.resolve(input as Sale),
      );

      const result = await service.ship('sale-1', 'company-a', 'user-1');

      expect(result.fulfillmentStatus).toBe(SaleFulfillmentStatus.Shipped);
      expect(result.shippedAt).toBeInstanceOf(Date);
    });

    it('rejects ship() on a DRAFT sale (fulfillmentStatus is null before confirmation)', async () => {
      saleRepository.findOne.mockResolvedValue(
        buildConfirmedSale({
          status: SaleStatus.Draft,
          fulfillmentStatus: null,
        }),
      );

      await expect(
        service.ship('sale-1', 'company-a', 'user-1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
      expect(saleRepository.save).not.toHaveBeenCalled();
    });

    it('rejects ship() when already SHIPPED (no double-ship)', async () => {
      saleRepository.findOne.mockResolvedValue(
        buildConfirmedSale({
          fulfillmentStatus: SaleFulfillmentStatus.Shipped,
        }),
      );

      await expect(
        service.ship('sale-1', 'company-a', 'user-1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('rejects ship() when already DELIVERED', async () => {
      saleRepository.findOne.mockResolvedValue(
        buildConfirmedSale({
          fulfillmentStatus: SaleFulfillmentStatus.Delivered,
        }),
      );

      await expect(
        service.ship('sale-1', 'company-a', 'user-1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('allows SHIPPED -> DELIVERED and stamps deliveredAt', async () => {
      saleRepository.findOne.mockResolvedValue(
        buildConfirmedSale({
          fulfillmentStatus: SaleFulfillmentStatus.Shipped,
        }),
      );
      saleRepository.save.mockImplementation((input) =>
        Promise.resolve(input as Sale),
      );

      const result = await service.deliver('sale-1', 'company-a', 'user-1');

      expect(result.fulfillmentStatus).toBe(SaleFulfillmentStatus.Delivered);
      expect(result.deliveredAt).toBeInstanceOf(Date);
    });

    it('rejects deliver() before shipping (PENDING_SHIPMENT -> DELIVERED is not a valid transition)', async () => {
      saleRepository.findOne.mockResolvedValue(buildConfirmedSale());

      await expect(
        service.deliver('sale-1', 'company-a', 'user-1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
      expect(saleRepository.save).not.toHaveBeenCalled();
    });

    it('rejects deliver() when already DELIVERED (no double-deliver)', async () => {
      saleRepository.findOne.mockResolvedValue(
        buildConfirmedSale({
          fulfillmentStatus: SaleFulfillmentStatus.Delivered,
        }),
      );

      await expect(
        service.deliver('sale-1', 'company-a', 'user-1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });
  });

  describe('findByIdInCompany — cross-company isolation', () => {
    it('throws NotFound for a sale belonging to a different company', async () => {
      saleRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findByIdInCompany('sale-1', 'company-b'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });
  });

  /**
   * Phase 16 (Payment) integration point — D16, EXPLICITLY AUTHORIZED
   * cross-phase addition. applyPayment() is the ONLY new method added to
   * this file; every other describe() block above exercises pre-existing,
   * untouched behavior (create/confirm/cancel/findByIdInCompany).
   */
  describe('applyPayment (Phase 16 integration point)', () => {
    const buildSale = (overrides: Record<string, unknown> = {}) =>
      ({
        id: 'sale-1',
        companyId: 'company-a',
        status: SaleStatus.Confirmed,
        paidAmount: '0.00',
        grandTotal: '100.00',
        ...overrides,
      }) as Sale;

    let applyManagerQueryBuilder: {
      where: jest.Mock;
      andWhere: jest.Mock;
      setLock: jest.Mock;
      getOne: jest.Mock;
    };

    beforeEach(() => {
      applyManagerQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getOne: jest.fn(),
      };
      manager.createQueryBuilder.mockReturnValue(applyManagerQueryBuilder);
    });

    it('locks the sale row with pessimistic_write before reading it', async () => {
      applyManagerQueryBuilder.getOne.mockResolvedValue(
        buildSale({ paidAmount: '0.00', grandTotal: '100.00' }),
      );

      await service.applyPayment(
        'sale-1',
        'company-a',
        40,
        'user-1',
        manager as unknown as EntityManager,
      );

      expect(applyManagerQueryBuilder.setLock).toHaveBeenCalledWith(
        'pessimistic_write',
      );
    });

    it('throws NotFound when the sale does not exist in the company', async () => {
      applyManagerQueryBuilder.getOne.mockResolvedValue(null);

      await expect(
        service.applyPayment(
          'sale-1',
          'company-a',
          40,
          'user-1',
          manager as unknown as EntityManager,
        ),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });

    it('adds the allocated amount to paidAmount and recomputes balanceAmount via manager.update()', async () => {
      applyManagerQueryBuilder.getOne.mockResolvedValue(
        buildSale({ id: 'sale-1', paidAmount: '20.00', grandTotal: '100.00' }),
      );

      await service.applyPayment(
        'sale-1',
        'company-a',
        30,
        'user-1',
        manager as unknown as EntityManager,
      );

      // manager.update() — never manager.save() — on the lock-hydrated
      // entity, the exact Phase 14-discovered bug class this method's
      // docblock documents avoiding.
      expect(manager.update).toHaveBeenCalledWith(Sale, 'sale-1', {
        paidAmount: '50.00',
        balanceAmount: '50.00',
        updatedBy: 'user-1',
      });
    });

    it('fully pays off a sale (paidAmount === grandTotal -> balanceAmount 0.00)', async () => {
      applyManagerQueryBuilder.getOne.mockResolvedValue(
        buildSale({ id: 'sale-1', paidAmount: '0.00', grandTotal: '75.00' }),
      );

      await service.applyPayment(
        'sale-1',
        'company-a',
        75,
        'user-1',
        manager as unknown as EntityManager,
      );

      expect(manager.update).toHaveBeenCalledWith(Sale, 'sale-1', {
        paidAmount: '75.00',
        balanceAmount: '0.00',
        updatedBy: 'user-1',
      });
    });

    it('rejects over-allocation (new paidAmount > grandTotal) with 409 Conflict', async () => {
      applyManagerQueryBuilder.getOne.mockResolvedValue(
        buildSale({ id: 'sale-1', paidAmount: '80.00', grandTotal: '100.00' }),
      );

      await expect(
        service.applyPayment(
          'sale-1',
          'company-a',
          30,
          'user-1',
          manager as unknown as EntityManager,
        ),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });

      expect(manager.update).not.toHaveBeenCalled();
    });
  });
  describe('previewItemPricing', () => {
    const basePreviewDto = {
      productVariantId: 'variant-1',
      quantity: 2,
    };

    beforeEach(() => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      productVariantsService.findByIdInCompany.mockResolvedValue(
        buildVariant(),
      );
      manager.find.mockImplementation((entity: unknown) => {
        if (entity === PriceList) {
          return Promise.resolve([buildPriceList()]);
        }
        return Promise.resolve([]);
      });
      manager.findOne.mockImplementation((entity: unknown) => {
        if (entity === PriceList) {
          return Promise.resolve(buildPriceList());
        }
        return Promise.resolve(null);
      });
      manager.findOneOrFail.mockResolvedValue(
        buildVariant({ product: { name: 'Test Product' } }),
      );
    });

    it('resolves UOM-aware exact pricing using the same active price-list rules as sale creation', async () => {
      productVariantUomsService.resolveSelectionForUsage.mockResolvedValue({
        uomId: 'uom-box',
        code: 'BOX',
        name: 'Box',
        symbol: null,
        conversionFactorToBase: '12.0000',
        usageType: ProductVariantUomUsageType.Sales,
        isBase: false,
      });
      priceListItemsService.resolveActivePrice.mockResolvedValue(
        buildPriceListItem({ price: '1200.00', uomId: 'uom-box' }),
      );

      const result = await service.previewItemPricing('company-a', {
        ...basePreviewDto,
        uomId: 'uom-box',
      });

      expect(priceListItemsService.resolveActivePrice).toHaveBeenCalledWith(
        'company-a',
        'pl-1',
        'variant-1',
        'uom-box',
        expect.any(Date),
      );
      expect(result).toMatchObject({
        productVariantId: 'variant-1',
        priceListId: 'pl-1',
        uomId: 'uom-box',
        uomCode: 'BOX',
        uomName: 'Box',
        quantity: 2,
        baseQuantity: 24,
        conversionFactorToBase: '12.0000',
        unitPrice: '1200.00',
      });
    });

    it('rejects preview when the company has zero or multiple active price lists and no explicit priceListId is supplied', async () => {
      manager.find.mockResolvedValue([
        buildPriceList(),
        buildPriceList({ id: 'pl-2' }),
      ]);

      await expect(
        service.previewItemPricing('company-a', basePreviewDto as never),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('allows preview with an explicit active priceListId even when multiple active price lists exist', async () => {
      manager.find.mockResolvedValue([
        buildPriceList(),
        buildPriceList({ id: 'pl-2' }),
      ]);
      manager.findOne.mockImplementation((entity: unknown) => {
        if (entity === PriceList) {
          return Promise.resolve(buildPriceList({ id: 'pl-2' }));
        }
        return Promise.resolve(null);
      });

      const result = await service.previewItemPricing('company-a', {
        ...basePreviewDto,
        priceListId: 'pl-2',
      });

      expect(result.priceListId).toBe('pl-2');
      expect(priceListItemsService.resolveActivePrice).toHaveBeenCalledWith(
        'company-a',
        'pl-2',
        'variant-1',
        null,
        expect.any(Date),
      );
    });
  });
});
