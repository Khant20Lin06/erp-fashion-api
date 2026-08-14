import { DashboardService } from './dashboard.service';
import { SalesReportsService } from './sales-reports.service';
import { PurchaseReportsService } from './purchase-reports.service';
import { PaymentReportsService } from './payment-reports.service';
import { InventoryReportsService } from './inventory-reports.service';
import { ArApAgingService } from './ar-ap-aging.service';
import { TrialBalanceService } from '../../accounting/services/trial-balance.service';
import { CacheService } from '../../redis/cache.service';
import { CacheKeys } from '../../redis/cache-keys';
import { PaymentDirection } from '../../payments/entities/payment-direction.enum';

describe('DashboardService', () => {
  let service: DashboardService;
  let salesReportsService: jest.Mocked<Pick<SalesReportsService, 'summary'>>;
  let purchaseReportsService: jest.Mocked<
    Pick<PurchaseReportsService, 'summary'>
  >;
  let paymentReportsService: jest.Mocked<
    Pick<PaymentReportsService, 'byDirection'>
  >;
  let inventoryReportsService: jest.Mocked<
    Pick<InventoryReportsService, 'stockSummary'>
  >;
  let arApAgingService: jest.Mocked<Pick<ArApAgingService, 'query'>>;
  let trialBalanceService: jest.Mocked<Pick<TrialBalanceService, 'query'>>;
  let cacheService: jest.Mocked<Pick<CacheService, 'get' | 'set'>>;

  beforeEach(() => {
    salesReportsService = {
      summary: jest.fn().mockResolvedValue({
        saleCount: 1,
        grandTotal: '100.00',
        subtotal: '100.00',
        discountAmount: '0.00',
        taxAmount: '0.00',
      }),
    };
    purchaseReportsService = {
      summary: jest.fn().mockResolvedValue({
        purchaseOrderCount: 1,
        grandTotal: '50.00',
        subtotal: '50.00',
        discountAmount: '0.00',
        taxAmount: '0.00',
      }),
    };
    paymentReportsService = {
      byDirection: jest.fn().mockResolvedValue([
        {
          direction: PaymentDirection.Receipt,
          paymentCount: 2,
          totalAmount: '200.00',
        },
        {
          direction: PaymentDirection.Payment,
          paymentCount: 1,
          totalAmount: '30.00',
        },
      ]),
    };
    inventoryReportsService = {
      stockSummary: jest.fn().mockResolvedValue([
        {
          warehouseId: 'wh-1',
          warehouseName: 'Main',
          productVariantId: 'var-1',
          sku: 'SKU-1',
          onHandQuantity: 10,
          reservedQuantity: 0,
        },
        {
          warehouseId: 'wh-1',
          warehouseName: 'Main',
          productVariantId: 'var-2',
          sku: 'SKU-2',
          onHandQuantity: 5,
          reservedQuantity: 0,
        },
      ]),
    };
    arApAgingService = {
      query: jest.fn().mockResolvedValue({
        asOfDate: '2026-08-13',
        receivables: [],
        payables: [],
        totalReceivables: '500.00',
        totalPayables: '75.00',
      }),
    };
    trialBalanceService = {
      query: jest.fn().mockResolvedValue({
        rows: [],
        totalDebit: '1000.00',
        totalCredit: '1000.00',
      }),
    };
    cacheService = {
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
    };

    service = new DashboardService(
      salesReportsService as unknown as SalesReportsService,
      purchaseReportsService as unknown as PurchaseReportsService,
      paymentReportsService as unknown as PaymentReportsService,
      inventoryReportsService as unknown as InventoryReportsService,
      arApAgingService as unknown as ArApAgingService,
      trialBalanceService as unknown as TrialBalanceService,
      cacheService as unknown as CacheService,
    );
  });

  it('composes a fresh dashboard from every underlying report service on a cache miss', async () => {
    const result = await service.getDashboard('company-a', {});

    expect(result.sales.grandTotal).toBe('100.00');
    expect(result.purchases.grandTotal).toBe('50.00');
    expect(result.payments.receiptTotal).toBe('200.00');
    expect(result.payments.paymentTotal).toBe('30.00');
    expect(result.receivablesOutstanding).toBe('500.00');
    expect(result.payablesOutstanding).toBe('75.00');
    expect(result.inventory.totalOnHandQuantity).toBe(15);
    expect(result.inventory.distinctProductVariantCount).toBe(2);
    expect(result.accounting.totalDebit).toBe('1000.00');
    expect(result.accounting.balanced).toBe(true);
    expect(result.cached).toBe(false);
    expect(result.asOfTimestamp).toBeDefined();
  });

  it('populates the cache after computing a fresh dashboard, with a company+scope+date-range key', async () => {
    await service.getDashboard('company-a', {
      branchId: 'branch-1',
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
    });

    expect(cacheService.set).toHaveBeenCalledWith(
      CacheKeys.dashboard('company-a', 'branch-1', '2026-01-01', '2026-01-31'),
      expect.any(Object),
      expect.any(Number),
    );
  });

  it('uses an allowedBranchIds-specific cache key when no explicit branchId is provided', async () => {
    await service.getDashboard('company-a', {
      allowedBranchIds: ['branch-2', 'branch-1'],
    });

    expect(cacheService.get).toHaveBeenCalledWith(
      CacheKeys.dashboard('company-a', 'branches:branch-1,branch-2', '', ''),
    );
    expect(cacheService.set).toHaveBeenCalledWith(
      CacheKeys.dashboard('company-a', 'branches:branch-1,branch-2', '', ''),
      expect.any(Object),
      expect.any(Number),
    );
  });

  it('returns the cached dashboard (marked cached=true) without recomputing on a cache hit', async () => {
    const cachedPayload = {
      period: { fromDate: null, toDate: null },
      companyId: 'company-a',
      branchId: null,
      sales: { saleCount: 99, grandTotal: '999.00' },
      purchases: { purchaseOrderCount: 0, grandTotal: '0.00' },
      payments: {
        receiptCount: 0,
        receiptTotal: '0.00',
        paymentCount: 0,
        paymentTotal: '0.00',
      },
      receivablesOutstanding: '0.00',
      payablesOutstanding: '0.00',
      inventory: { totalOnHandQuantity: 0, distinctProductVariantCount: 0 },
      accounting: { totalDebit: '0.00', totalCredit: '0.00', balanced: true },
      cached: false,
      asOfTimestamp: '2026-08-13T00:00:00.000Z',
    };
    cacheService.get.mockResolvedValue(cachedPayload);

    const result = await service.getDashboard('company-a', {});

    expect(result.cached).toBe(true);
    expect(result.sales.grandTotal).toBe('999.00');
    // asOfTimestamp is preserved from the cached snapshot, not overwritten to "now" — the client must see when the data was actually computed.
    expect(result.asOfTimestamp).toBe('2026-08-13T00:00:00.000Z');
    expect(salesReportsService.summary).not.toHaveBeenCalled();
  });

  it('never fabricates a gross-profit/COGS/tax figure — the DTO has no such field', async () => {
    const result = await service.getDashboard('company-a', {});

    expect(result).not.toHaveProperty('grossProfit');
    expect(result).not.toHaveProperty('cogs');
    expect(result).not.toHaveProperty('netProfit');
  });
  it('passes allowedBranchIds through to every underlying branch-scoped service', async () => {
    await service.getDashboard('company-a', {
      allowedBranchIds: ['branch-1', 'branch-2'],
    });

    expect(salesReportsService.summary).toHaveBeenCalledWith(
      'company-a',
      expect.objectContaining({
        allowedBranchIds: ['branch-1', 'branch-2'],
      }),
    );
    expect(purchaseReportsService.summary).toHaveBeenCalledWith(
      'company-a',
      expect.objectContaining({
        allowedBranchIds: ['branch-1', 'branch-2'],
      }),
    );
    expect(paymentReportsService.byDirection).toHaveBeenCalledWith(
      'company-a',
      expect.objectContaining({
        allowedBranchIds: ['branch-1', 'branch-2'],
      }),
    );
    expect(inventoryReportsService.stockSummary).toHaveBeenCalledWith(
      'company-a',
      expect.objectContaining({
        allowedBranchIds: ['branch-1', 'branch-2'],
      }),
    );
    expect(arApAgingService.query).toHaveBeenCalledWith(
      'company-a',
      expect.objectContaining({
        allowedBranchIds: ['branch-1', 'branch-2'],
      }),
    );
    expect(trialBalanceService.query).toHaveBeenCalledWith(
      'company-a',
      expect.objectContaining({
        allowedBranchIds: ['branch-1', 'branch-2'],
      }),
    );
  });
});
