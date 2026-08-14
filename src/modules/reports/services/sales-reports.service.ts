import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Sale } from '../../sales/entities/sale.entity';
import { SaleStatus } from '../../sales/entities/sale-status.enum';
import { SalesReportQueryDto } from '../dto/sales-report-query.dto';

export interface SalesSummary {
  saleCount: number;
  grandTotal: string;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
}

export interface SalesByDateRow {
  date: string;
  saleCount: number;
  grandTotal: string;
}

export interface SalesByCustomerRow {
  customerId: string;
  customerCode: string;
  customerName: string;
  saleCount: number;
  grandTotal: string;
}

export interface SalesByBranchRow {
  branchId: string | null;
  branchName: string | null;
  saleCount: number;
  grandTotal: string;
}

/**
 * New Phase 22 report — Sales (summary/by-date/by-customer/by-branch), from
 * real Sale data. Every query filters to CONFIRMED sales only (DRAFT/
 * CANCELLED are not real completed transactions — mirrors the
 * POSTED-only-for-accounting convention applied to the operational domain).
 * SQL-level aggregation (SUM/GROUP BY) throughout, never fetch-all-then-
 * reduce-in-JS. DataScope enforcement (companyId/branchId) happens in the
 * controller via resolveRequestCompanyId, matching GeneralLedgerController's
 * own pattern — this service trusts the companyId it is given.
 */
@Injectable()
export class SalesReportsService {
  constructor(
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
  ) {}

  private baseQuery(
    companyId: string,
    query: SalesReportQueryDto & { allowedBranchIds?: string[] | null },
  ): SelectQueryBuilder<Sale> {
    const qb = this.saleRepository
      .createQueryBuilder('sale')
      .where('sale.companyId = :companyId', { companyId })
      .andWhere('sale.status = :status', { status: SaleStatus.Confirmed });

    if (query.branchId) {
      qb.andWhere('sale.branchId = :branchId', { branchId: query.branchId });
    } else if (query.allowedBranchIds?.length) {
      qb.andWhere('sale.branchId IN (:...allowedBranchIds)', {
        allowedBranchIds: query.allowedBranchIds,
      });
    }
    if (query.fromDate) {
      qb.andWhere('sale.transactionDate >= :fromDate', {
        fromDate: query.fromDate,
      });
    }
    if (query.toDate) {
      qb.andWhere('sale.transactionDate <= :toDate', { toDate: query.toDate });
    }
    return qb;
  }

  async summary(
    companyId: string,
    query: SalesReportQueryDto & { allowedBranchIds?: string[] | null },
  ): Promise<SalesSummary> {
    const raw = await this.baseQuery(companyId, query)
      .select('COUNT(sale.id)', 'saleCount')
      .addSelect('COALESCE(SUM(sale.grandTotal), 0)', 'grandTotal')
      .addSelect('COALESCE(SUM(sale.subtotal), 0)', 'subtotal')
      .addSelect('COALESCE(SUM(sale.discountAmount), 0)', 'discountAmount')
      .addSelect('COALESCE(SUM(sale.taxAmount), 0)', 'taxAmount')
      .getRawOne<{
        saleCount: string;
        grandTotal: string;
        subtotal: string;
        discountAmount: string;
        taxAmount: string;
      }>();

    return {
      saleCount: Number(raw?.saleCount ?? 0),
      grandTotal: Number(raw?.grandTotal ?? 0).toFixed(2),
      subtotal: Number(raw?.subtotal ?? 0).toFixed(2),
      discountAmount: Number(raw?.discountAmount ?? 0).toFixed(2),
      taxAmount: Number(raw?.taxAmount ?? 0).toFixed(2),
    };
  }

  async byDate(
    companyId: string,
    query: SalesReportQueryDto & { allowedBranchIds?: string[] | null },
  ): Promise<SalesByDateRow[]> {
    const rows = await this.baseQuery(companyId, query)
      .select('DATE(sale.transactionDate)', 'date')
      .addSelect('COUNT(sale.id)', 'saleCount')
      .addSelect('COALESCE(SUM(sale.grandTotal), 0)', 'grandTotal')
      .groupBy('DATE(sale.transactionDate)')
      .orderBy('DATE(sale.transactionDate)', 'ASC')
      .getRawMany<{ date: string; saleCount: string; grandTotal: string }>();

    return rows.map((row) => ({
      date: row.date,
      saleCount: Number(row.saleCount),
      grandTotal: Number(row.grandTotal).toFixed(2),
    }));
  }

  async byCustomer(
    companyId: string,
    query: SalesReportQueryDto & { allowedBranchIds?: string[] | null },
  ): Promise<SalesByCustomerRow[]> {
    const rows = await this.baseQuery(companyId, query)
      .innerJoin('sale.customer', 'customer')
      .select('customer.id', 'customerId')
      .addSelect('customer.customerCode', 'customerCode')
      .addSelect('customer.name', 'customerName')
      .addSelect('COUNT(sale.id)', 'saleCount')
      .addSelect('COALESCE(SUM(sale.grandTotal), 0)', 'grandTotal')
      .groupBy('customer.id')
      .addGroupBy('customer.customerCode')
      .addGroupBy('customer.name')
      .orderBy('grandTotal', 'DESC')
      .getRawMany<{
        customerId: string;
        customerCode: string;
        customerName: string;
        saleCount: string;
        grandTotal: string;
      }>();

    return rows.map((row) => ({
      customerId: row.customerId,
      customerCode: row.customerCode,
      customerName: row.customerName,
      saleCount: Number(row.saleCount),
      grandTotal: Number(row.grandTotal).toFixed(2),
    }));
  }

  async byBranch(
    companyId: string,
    query: SalesReportQueryDto & { allowedBranchIds?: string[] | null },
  ): Promise<SalesByBranchRow[]> {
    const rows = await this.baseQuery(companyId, query)
      .leftJoin('sale.branch', 'branch')
      .select('branch.id', 'branchId')
      .addSelect('branch.name', 'branchName')
      .addSelect('COUNT(sale.id)', 'saleCount')
      .addSelect('COALESCE(SUM(sale.grandTotal), 0)', 'grandTotal')
      .groupBy('branch.id')
      .addGroupBy('branch.name')
      .orderBy('grandTotal', 'DESC')
      .getRawMany<{
        branchId: string | null;
        branchName: string | null;
        saleCount: string;
        grandTotal: string;
      }>();

    return rows.map((row) => ({
      branchId: row.branchId,
      branchName: row.branchName,
      saleCount: Number(row.saleCount),
      grandTotal: Number(row.grandTotal).toFixed(2),
    }));
  }
}
