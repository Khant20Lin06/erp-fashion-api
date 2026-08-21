import { EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrder } from '../entities/purchase-order.entity';
import { PurchaseOrderStatus } from '../entities/purchase-order-status.enum';
import { CompanyPurchaseCounter } from '../entities/company-purchase-counter.entity';
import { GoodsReceipt } from '../../inventory/entities/goods-receipt.entity';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { CompaniesService } from '../../organization/services/companies.service';
import { BranchesService } from '../../organization/services/branches.service';
import { WarehousesService } from '../../organization/services/warehouses.service';
import { WarehouseStatus } from '../../organization/entities/warehouse-status.enum';
import { SuppliersService } from '../../customer-supplier/services/suppliers.service';
import { SupplierStatus } from '../../customer-supplier/entities/supplier-status.enum';
import { PaymentTermsService } from '../../customer-supplier/services/payment-terms.service';
import { PaymentTermStatus } from '../../customer-supplier/entities/payment-term-status.enum';
import { ProductVariantsService } from '../../products/services/product-variants.service';
import { ProductVariantStatus } from '../../products/entities/product-variant-status.enum';
import { CompanyStatus } from '../../organization/entities/company-status.enum';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('PurchaseOrdersService', () => {
  let service: PurchaseOrdersService;
  let purchaseOrderRepository: jest.Mocked<
    Pick<Repository<PurchaseOrder>, 'findOne' | 'save' | 'createQueryBuilder'>
  >;
  let goodsReceiptRepository: jest.Mocked<
    Pick<Repository<GoodsReceipt>, 'count'>
  >;
  let transactionService: jest.Mocked<Pick<TransactionService, 'run'>>;
  let companiesService: jest.Mocked<
    Pick<CompaniesService, 'findActiveByIdOrNull'>
  >;
  let branchesService: jest.Mocked<
    Pick<BranchesService, 'findActiveByIdOrNull'>
  >;
  let warehousesService: jest.Mocked<Pick<WarehousesService, 'findById'>>;
  let suppliersService: jest.Mocked<
    Pick<SuppliersService, 'findByIdInCompany'>
  >;
  let paymentTermsService: jest.Mocked<
    Pick<PaymentTermsService, 'findByIdInCompany'>
  >;
  let productVariantsService: jest.Mocked<
    Pick<ProductVariantsService, 'findByIdInCompany'>
  >;
  let queryBuilder: jest.Mocked<
    Pick<
      SelectQueryBuilder<PurchaseOrder>,
      | 'where'
      | 'andWhere'
      | 'leftJoinAndSelect'
      | 'loadRelationCountAndMap'
      | 'distinct'
      | 'orderBy'
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
  let managerQueryBuilder: {
    where: jest.Mock;
    andWhere: jest.Mock;
    setLock: jest.Mock;
    getOneOrFail: jest.Mock;
  };

  const buildCompany = () =>
    ({ id: 'company-a', status: CompanyStatus.Active }) as never;
  const buildSupplier = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'sup-1',
      companyId: 'company-a',
      status: SupplierStatus.Active,
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
  const buildPaymentTerm = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'pt-1',
      companyId: 'company-a',
      status: PaymentTermStatus.Active,
      ...overrides,
    }) as never;
  const buildCounter = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'counter-1',
      companyId: 'company-a',
      year: 2026,
      lastSequence: 0,
      ...overrides,
    }) as CompanyPurchaseCounter;

  beforeEach(() => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      loadRelationCountAndMap: jest.fn().mockReturnThis(),
      distinct: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };
    purchaseOrderRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    goodsReceiptRepository = {
      count: jest.fn().mockResolvedValue(0),
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
    suppliersService = { findByIdInCompany: jest.fn() };
    paymentTermsService = { findByIdInCompany: jest.fn() };
    productVariantsService = { findByIdInCompany: jest.fn() };

    service = new PurchaseOrdersService(
      purchaseOrderRepository as unknown as Repository<PurchaseOrder>,
      goodsReceiptRepository as unknown as Repository<GoodsReceipt>,
      transactionService as unknown as TransactionService,
      companiesService as unknown as CompaniesService,
      branchesService as unknown as BranchesService,
      warehousesService as unknown as WarehousesService,
      suppliersService as unknown as SuppliersService,
      paymentTermsService as unknown as PaymentTermsService,
      productVariantsService as unknown as ProductVariantsService,
    );
  });

  describe('create', () => {
    const baseDto = {
      supplierId: 'sup-1',
      currency: 'USD',
      items: [
        { productVariantId: 'variant-1', quantity: 2, unitCost: '100.00' },
      ],
    };

    beforeEach(() => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      suppliersService.findByIdInCompany.mockResolvedValue(buildSupplier());
      productVariantsService.findByIdInCompany.mockResolvedValue(
        buildVariant(),
      );
      manager.findOneOrFail.mockResolvedValue(buildVariant());
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

    it('rejects a blocked supplier', async () => {
      suppliersService.findByIdInCompany.mockResolvedValue(
        buildSupplier({ status: SupplierStatus.Blocked }),
      );

      await expect(
        service.create('company-a', 'user-1', baseDto as never),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects a cross-company supplier as not found (404) via findByIdInCompany', async () => {
      suppliersService.findByIdInCompany.mockRejectedValue(
        Object.assign(new Error('Supplier not found'), {
          errorCode: ErrorCode.NotFound,
        }),
      );

      await expect(
        service.create('company-a', 'user-1', baseDto as never),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });

    it('validates a supplied paymentTermId belongs to the company and is active', async () => {
      paymentTermsService.findByIdInCompany.mockResolvedValue(
        buildPaymentTerm(),
      );

      const result = await service.create('company-a', 'user-1', {
        ...baseDto,
        paymentTermId: 'pt-1',
      });

      expect(paymentTermsService.findByIdInCompany).toHaveBeenCalledWith(
        'pt-1',
        'company-a',
      );
      expect(result.paymentTermId).toBe('pt-1');
    });

    it('rejects an inactive paymentTermId', async () => {
      paymentTermsService.findByIdInCompany.mockResolvedValue(
        buildPaymentTerm({ status: PaymentTermStatus.Inactive }),
      );

      await expect(
        service.create('company-a', 'user-1', {
          ...baseDto,
          paymentTermId: 'pt-1',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('generates a purchase order number using the locked counter and computes totals server-side from client-supplied unitCost, ignoring any client-supplied totals', async () => {
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
      expect(result.purchaseOrderNumber).toMatch(/^PO-\d{4}-\d{6}$/);
      // unit cost 100.00 * qty 2 = 200.00, no discount/tax
      expect(result.subtotal).toBe('200.00');
      expect(result.grandTotal).toBe('200.00');
      expect(result.balanceAmount).toBe('200.00');
      expect(result.paidAmount).toBe('0.00');
      expect(result.status).toBe(PurchaseOrderStatus.Draft);
    });

    it('rejects a negative unitCost', async () => {
      await expect(
        service.create('company-a', 'user-1', {
          ...baseDto,
          items: [
            {
              productVariantId: 'variant-1',
              quantity: 1,
              unitCost: '-10.00',
            },
          ],
        }),
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
              unitCost: '10.00',
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
          {
            productVariantId: 'variant-1',
            quantity: 1,
            unitCost: '100.00',
            taxAmount: '10.00',
          },
        ],
      });

      // unitCost 100.00 * qty 1 + tax 10.00 = 110.00
      expect(result.grandTotal).toBe('110.00');
      expect(result.taxAmount).toBe('10.00');
    });

    it('defaults currency-agnostic purchaseType to STANDARD when omitted', async () => {
      const result = await service.create('company-a', 'user-1', baseDto);
      expect(result.purchaseType).toBe('STANDARD');
    });
  });

  describe('confirm / cancel — lifecycle transitions', () => {
    const buildPurchaseOrder = (overrides: Record<string, unknown> = {}) =>
      ({
        id: 'po-1',
        companyId: 'company-a',
        status: PurchaseOrderStatus.Draft,
        ...overrides,
      }) as PurchaseOrder;

    it('allows DRAFT -> CONFIRMED', async () => {
      purchaseOrderRepository.findOne.mockResolvedValue(buildPurchaseOrder());
      purchaseOrderRepository.save.mockImplementation((input) =>
        Promise.resolve(input as PurchaseOrder),
      );

      const result = await service.confirm('po-1', 'company-a', 'user-1');

      expect(result.status).toBe(PurchaseOrderStatus.Confirmed);
    });

    it('allows DRAFT -> CANCELLED', async () => {
      purchaseOrderRepository.findOne.mockResolvedValue(buildPurchaseOrder());
      purchaseOrderRepository.save.mockImplementation((input) =>
        Promise.resolve(input as PurchaseOrder),
      );

      const result = await service.cancel('po-1', 'company-a', 'user-1');

      expect(result.status).toBe(PurchaseOrderStatus.Cancelled);
    });

    it('rejects CONFIRMED -> CANCELLED with a 409 conflict', async () => {
      purchaseOrderRepository.findOne.mockResolvedValue(
        buildPurchaseOrder({ status: PurchaseOrderStatus.Confirmed }),
      );

      await expect(
        service.cancel('po-1', 'company-a', 'user-1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('rejects CONFIRMED -> CONFIRMED re-confirm with a 409 conflict', async () => {
      purchaseOrderRepository.findOne.mockResolvedValue(
        buildPurchaseOrder({ status: PurchaseOrderStatus.Confirmed }),
      );

      await expect(
        service.confirm('po-1', 'company-a', 'user-1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('rejects CANCELLED -> CONFIRMED with a 409 conflict', async () => {
      purchaseOrderRepository.findOne.mockResolvedValue(
        buildPurchaseOrder({ status: PurchaseOrderStatus.Cancelled }),
      );

      await expect(
        service.confirm('po-1', 'company-a', 'user-1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('rejects CANCELLED -> CANCELLED (no-op re-cancel) with a 409 conflict', async () => {
      purchaseOrderRepository.findOne.mockResolvedValue(
        buildPurchaseOrder({ status: PurchaseOrderStatus.Cancelled }),
      );

      await expect(
        service.cancel('po-1', 'company-a', 'user-1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('rejects cancelling a purchase order that already has a goods receipt recorded against it (Phase 14 addition)', async () => {
      purchaseOrderRepository.findOne.mockResolvedValue(buildPurchaseOrder());
      goodsReceiptRepository.count.mockResolvedValue(1);

      await expect(
        service.cancel('po-1', 'company-a', 'user-1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
      expect(goodsReceiptRepository.count).toHaveBeenCalledWith({
        where: { purchaseOrderId: 'po-1' },
      });
    });
  });

  describe('findByIdInCompany — cross-company isolation', () => {
    it('throws NotFound for a purchase order belonging to a different company', async () => {
      purchaseOrderRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findByIdInCompany('po-1', 'company-b'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });
  });

  /**
   * Phase 16 (Payment) integration point — D16, EXPLICITLY AUTHORIZED
   * cross-phase addition, direct mirror of SalesService.applyPayment()'s
   * own test suite. applyPayment() is the ONLY new method added to this
   * file; every other describe() block above exercises pre-existing,
   * untouched behavior (create/confirm/cancel/findByIdInCompany).
   */
  describe('applyPayment (Phase 16 integration point)', () => {
    const buildPurchaseOrderForPayment = (
      overrides: Record<string, unknown> = {},
    ) =>
      ({
        id: 'po-1',
        companyId: 'company-a',
        status: PurchaseOrderStatus.Confirmed,
        paidAmount: '0.00',
        grandTotal: '100.00',
        ...overrides,
      }) as PurchaseOrder;

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

    it('locks the purchase order row with pessimistic_write before reading it', async () => {
      applyManagerQueryBuilder.getOne.mockResolvedValue(
        buildPurchaseOrderForPayment(),
      );

      await service.applyPayment(
        'po-1',
        'company-a',
        40,
        'user-1',
        manager as unknown as EntityManager,
      );

      expect(applyManagerQueryBuilder.setLock).toHaveBeenCalledWith(
        'pessimistic_write',
      );
    });

    it('throws NotFound when the purchase order does not exist in the company', async () => {
      applyManagerQueryBuilder.getOne.mockResolvedValue(null);

      await expect(
        service.applyPayment(
          'po-1',
          'company-a',
          40,
          'user-1',
          manager as unknown as EntityManager,
        ),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });

    it('adds the allocated amount to paidAmount and recomputes balanceAmount via manager.update()', async () => {
      applyManagerQueryBuilder.getOne.mockResolvedValue(
        buildPurchaseOrderForPayment({
          paidAmount: '20.00',
          grandTotal: '100.00',
        }),
      );

      await service.applyPayment(
        'po-1',
        'company-a',
        30,
        'user-1',
        manager as unknown as EntityManager,
      );

      // manager.update() — never manager.save() — on the lock-hydrated
      // entity, the exact Phase 14-discovered bug class this method's
      // docblock documents avoiding.
      expect(manager.update).toHaveBeenCalledWith(PurchaseOrder, 'po-1', {
        paidAmount: '50.00',
        balanceAmount: '50.00',
        updatedBy: 'user-1',
      });
    });

    it('rejects over-allocation (new paidAmount > grandTotal) with 409 Conflict', async () => {
      applyManagerQueryBuilder.getOne.mockResolvedValue(
        buildPurchaseOrderForPayment({
          paidAmount: '80.00',
          grandTotal: '100.00',
        }),
      );

      await expect(
        service.applyPayment(
          'po-1',
          'company-a',
          30,
          'user-1',
          manager as unknown as EntityManager,
        ),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });

      expect(manager.update).not.toHaveBeenCalled();
    });
  });
});
