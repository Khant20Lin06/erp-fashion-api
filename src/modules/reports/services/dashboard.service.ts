import { Injectable } from '@nestjs/common';
import { SalesReportsService } from './sales-reports.service';
import { PurchaseReportsService } from './purchase-reports.service';
import { PaymentReportsService } from './payment-reports.service';
import { InventoryReportsService } from './inventory-reports.service';
import { ArApAgingService } from './ar-ap-aging.service';
import { TrialBalanceService } from '../../accounting/services/trial-balance.service';
import { DashboardQueryDto } from '../dto/dashboard-query.dto';
import { DashboardResponseDto } from '../dto/dashboard-response.dto';
import { CacheService } from '../../redis/cache.service';
import { CacheKeys, CacheTtl } from '../../redis/cache-keys';
import { PaymentDirection } from '../../payments/entities/payment-direction.enum';

/**
 * Dashboard (Phase 22, LOCKED): one GET /reports/dashboard endpoint,
 * composing already-built report services rather than re-deriving their
 * queries — no duplicate aggregation logic. Every underlying call is
 * itself SQL-level aggregation (SUM/COUNT/GROUP BY), so this composition
 * adds no fetch-all-then-reduce-in-JS anywhere.
 *
 * Redis caching (LOCKED, and the ONLY report this phase caches — Trial
 * Balance/General Ledger/Balance Sheet/P&L are explicitly NOT cached):
 * cache-aside, key includes companyId + branch scope + date range, short
 * TTL (120s, within the locked 60-300s range), and the response always
 * carries `cached`/`asOfTimestamp` so a client can tell a cached snapshot
 * from a fresh one — never silently indistinguishable.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly salesReportsService: SalesReportsService,
    private readonly purchaseReportsService: PurchaseReportsService,
    private readonly paymentReportsService: PaymentReportsService,
    private readonly inventoryReportsService: InventoryReportsService,
    private readonly arApAgingService: ArApAgingService,
    private readonly trialBalanceService: TrialBalanceService,
    private readonly cacheService: CacheService,
  ) {}

  private resolveBranchScopeCacheKey(
    branchId: string | undefined,
    allowedBranchIds: string[] | null | undefined,
  ): string {
    if (branchId) {
      return branchId;
    }
    if (allowedBranchIds?.length) {
      return `branches:${[...allowedBranchIds].sort().join(',')}`;
    }
    return 'all';
  }

  async getDashboard(
    companyId: string,
    query: DashboardQueryDto & { allowedBranchIds?: string[] | null },
  ): Promise<DashboardResponseDto> {
    const branchScope = this.resolveBranchScopeCacheKey(
      query.branchId,
      query.allowedBranchIds,
    );
    const fromDate = query.fromDate ?? '';
    const toDate = query.toDate ?? '';
    const cacheKey = CacheKeys.dashboard(
      companyId,
      branchScope,
      fromDate,
      toDate,
    );

    const cached = await this.cacheService.get<DashboardResponseDto>(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }

    const fresh = await this.computeDashboard(companyId, query);
    await this.cacheService.set(cacheKey, fresh, CacheTtl.DASHBOARD_SECONDS);
    return fresh;
  }

  private async computeDashboard(
    companyId: string,
    query: DashboardQueryDto & { allowedBranchIds?: string[] | null },
  ): Promise<DashboardResponseDto> {
    const reportQuery = {
      companyId,
      branchId: query.branchId,
      fromDate: query.fromDate,
      toDate: query.toDate,
      allowedBranchIds: query.allowedBranchIds,
    };

    const [
      salesSummary,
      purchaseSummary,
      paymentsByDirection,
      stockSummary,
      arApAging,
      trialBalance,
    ] = await Promise.all([
      this.salesReportsService.summary(companyId, reportQuery),
      this.purchaseReportsService.summary(companyId, reportQuery),
      this.paymentReportsService.byDirection(companyId, reportQuery),
      this.inventoryReportsService.stockSummary(companyId, {
        companyId,
        branchId: query.branchId,
        warehouseId: undefined,
        allowedBranchIds: query.allowedBranchIds,
      }),
      this.arApAgingService.query(companyId, {
        companyId,
        branchId: query.branchId,
        asOfDate: query.toDate,
        allowedBranchIds: query.allowedBranchIds,
      }),
      this.trialBalanceService.query(companyId, {
        companyId,
        branchId: query.branchId,
        asOfDate: query.toDate,
        allowedBranchIds: query.allowedBranchIds,
      }),
    ]);

    const receiptRow = paymentsByDirection.find(
      (row) => row.direction === PaymentDirection.Receipt,
    );
    const paymentRow = paymentsByDirection.find(
      (row) => row.direction === PaymentDirection.Payment,
    );

    const totalOnHandQuantity = stockSummary.reduce(
      (sum, row) => sum + row.onHandQuantity,
      0,
    );
    const distinctProductVariantCount = new Set(
      stockSummary.map((row) => row.productVariantId),
    ).size;

    return {
      period: {
        fromDate: query.fromDate ?? null,
        toDate: query.toDate ?? null,
      },
      companyId,
      branchId: query.branchId ?? null,
      sales: {
        saleCount: salesSummary.saleCount,
        grandTotal: salesSummary.grandTotal,
      },
      purchases: {
        purchaseOrderCount: purchaseSummary.purchaseOrderCount,
        grandTotal: purchaseSummary.grandTotal,
      },
      payments: {
        receiptCount: receiptRow?.paymentCount ?? 0,
        receiptTotal: receiptRow?.totalAmount ?? '0.00',
        paymentCount: paymentRow?.paymentCount ?? 0,
        paymentTotal: paymentRow?.totalAmount ?? '0.00',
      },
      receivablesOutstanding: arApAging.totalReceivables,
      payablesOutstanding: arApAging.totalPayables,
      inventory: {
        totalOnHandQuantity,
        distinctProductVariantCount,
      },
      accounting: {
        totalDebit: trialBalance.totalDebit,
        totalCredit: trialBalance.totalCredit,
        balanced: trialBalance.totalDebit === trialBalance.totalCredit,
      },
      cached: false,
      asOfTimestamp: new Date().toISOString(),
    };
  }
}
