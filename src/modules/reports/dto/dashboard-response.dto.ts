/**
 * Explicit, typed dashboard summary DTO (locked spec: "never raw entity
 * dumps, only metrics genuinely derivable from real data — no fabricated
 * gross profit/COGS/tax"). Every field here is a real SQL-aggregated value
 * sourced from an already-built report/accounting service — this DTO is
 * purely a composition shape, never its own data source (see
 * DashboardService.computeDashboard()).
 */
export class DashboardResponseDto {
  period!: {
    fromDate: string | null;
    toDate: string | null;
  };

  companyId!: string;
  branchId!: string | null;

  sales!: {
    saleCount: number;
    grandTotal: string;
  };

  purchases!: {
    purchaseOrderCount: number;
    grandTotal: string;
  };

  payments!: {
    receiptCount: number;
    receiptTotal: string;
    paymentCount: number;
    paymentTotal: string;
  };

  /** Real AR/AP aging totals (ArApAgingService), not a fabricated figure. */
  receivablesOutstanding!: string;
  payablesOutstanding!: string;

  inventory!: {
    totalOnHandQuantity: number;
    distinctProductVariantCount: number;
  };

  /**
   * Sourced from the already-built TrialBalanceService (never a duplicate
   * Balance Sheet computation just for the dashboard) — totalDebit ===
   * totalCredit is the fundamental accounting invariant, surfaced here so a
   * dashboard consumer has a cheap sanity signal without calling
   * GET /trial-balance separately.
   */
  accounting!: {
    totalDebit: string;
    totalCredit: string;
    balanced: boolean;
  };

  /**
   * When this response was actually computed (not when it was served) —
   * present on both a fresh and a cached response so a client can always
   * tell what data-freshness window it is looking at (locked spec
   * requirement: "never silently present stale financial data as if it
   * were live with no indication").
   */
  asOfTimestamp!: string;

  /** True when this response was served from the Redis cache rather than computed fresh for this request. */
  cached!: boolean;
}
