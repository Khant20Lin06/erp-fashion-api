import { ApiProperty } from '@nestjs/swagger';

class DashboardPeriodDto {
  @ApiProperty({
    example: '2026-08-01',
    nullable: true,
  })
  fromDate!: string | null;

  @ApiProperty({
    example: '2026-08-15',
    nullable: true,
  })
  toDate!: string | null;
}

class DashboardSalesSummaryDto {
  @ApiProperty({ example: 12 })
  saleCount!: number;

  @ApiProperty({ example: '2450.00' })
  grandTotal!: string;
}

class DashboardPurchaseSummaryDto {
  @ApiProperty({ example: 4 })
  purchaseOrderCount!: number;

  @ApiProperty({ example: '1180.00' })
  grandTotal!: string;
}

class DashboardPaymentSummaryDto {
  @ApiProperty({ example: 7 })
  receiptCount!: number;

  @ApiProperty({ example: '1450.00' })
  receiptTotal!: string;

  @ApiProperty({ example: 3 })
  paymentCount!: number;

  @ApiProperty({ example: '820.00' })
  paymentTotal!: string;
}

class DashboardInventorySummaryDto {
  @ApiProperty({ example: 128 })
  totalOnHandQuantity!: number;

  @ApiProperty({ example: 24 })
  distinctProductVariantCount!: number;
}

class DashboardAccountingSummaryDto {
  @ApiProperty({ example: '5000.00' })
  totalDebit!: string;

  @ApiProperty({ example: '5000.00' })
  totalCredit!: string;

  @ApiProperty({ example: true })
  balanced!: boolean;
}

/**
 * Explicit, typed dashboard summary DTO. Every field here is derived from
 * existing report/accounting services and never from fabricated metrics.
 */
export class DashboardResponseDto {
  @ApiProperty({ type: DashboardPeriodDto })
  period!: DashboardPeriodDto;

  @ApiProperty({ format: 'uuid' })
  companyId!: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  branchId!: string | null;

  @ApiProperty({ type: DashboardSalesSummaryDto })
  sales!: DashboardSalesSummaryDto;

  @ApiProperty({ type: DashboardPurchaseSummaryDto })
  purchases!: DashboardPurchaseSummaryDto;

  @ApiProperty({ type: DashboardPaymentSummaryDto })
  payments!: DashboardPaymentSummaryDto;

  @ApiProperty({ example: '950.00' })
  receivablesOutstanding!: string;

  @ApiProperty({ example: '410.00' })
  payablesOutstanding!: string;

  @ApiProperty({ type: DashboardInventorySummaryDto })
  inventory!: DashboardInventorySummaryDto;

  @ApiProperty({ type: DashboardAccountingSummaryDto })
  accounting!: DashboardAccountingSummaryDto;

  @ApiProperty({ example: '2026-08-15T09:00:00.000Z' })
  asOfTimestamp!: string;

  @ApiProperty({ example: false })
  cached!: boolean;
}
