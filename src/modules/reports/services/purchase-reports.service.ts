import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { PurchaseOrder } from '../../purchase/entities/purchase-order.entity';
import { PurchaseOrderStatus } from '../../purchase/entities/purchase-order-status.enum';
import { PurchaseReportQueryDto } from '../dto/purchase-report-query.dto';

export interface PurchaseSummary {
  purchaseOrderCount: number;
  grandTotal: string;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
}

export interface PurchaseByDateRow {
  date: string;
  purchaseOrderCount: number;
  grandTotal: string;
}

export interface PurchaseBySupplierRow {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  purchaseOrderCount: number;
  grandTotal: string;
}

/**
 * New Phase 22 report — Purchase (summary/by-date/by-supplier), from real
 * PurchaseOrder data. CONFIRMED only (same convention as SalesReportsService).
 * SQL-level aggregation throughout.
 */
@Injectable()
export class PurchaseReportsService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrderRepository: Repository<PurchaseOrder>,
  ) {}

  private baseQuery(
    companyId: string,
    query: PurchaseReportQueryDto & { allowedBranchIds?: string[] | null },
  ): SelectQueryBuilder<PurchaseOrder> {
    const qb = this.purchaseOrderRepository
      .createQueryBuilder('po')
      .where('po.companyId = :companyId', { companyId })
      .andWhere('po.status = :status', {
        status: PurchaseOrderStatus.Confirmed,
      });

    if (query.branchId) {
      qb.andWhere('po.branchId = :branchId', { branchId: query.branchId });
    } else if (query.allowedBranchIds?.length) {
      qb.andWhere('po.branchId IN (:...allowedBranchIds)', {
        allowedBranchIds: query.allowedBranchIds,
      });
    }
    if (query.fromDate) {
      qb.andWhere('po.transactionDate >= :fromDate', {
        fromDate: query.fromDate,
      });
    }
    if (query.toDate) {
      qb.andWhere('po.transactionDate <= :toDate', { toDate: query.toDate });
    }
    return qb;
  }

  async summary(
    companyId: string,
    query: PurchaseReportQueryDto & { allowedBranchIds?: string[] | null },
  ): Promise<PurchaseSummary> {
    const raw = await this.baseQuery(companyId, query)
      .select('COUNT(po.id)', 'purchaseOrderCount')
      .addSelect('COALESCE(SUM(po.grandTotal), 0)', 'grandTotal')
      .addSelect('COALESCE(SUM(po.subtotal), 0)', 'subtotal')
      .addSelect('COALESCE(SUM(po.discountAmount), 0)', 'discountAmount')
      .addSelect('COALESCE(SUM(po.taxAmount), 0)', 'taxAmount')
      .getRawOne<{
        purchaseOrderCount: string;
        grandTotal: string;
        subtotal: string;
        discountAmount: string;
        taxAmount: string;
      }>();

    return {
      purchaseOrderCount: Number(raw?.purchaseOrderCount ?? 0),
      grandTotal: Number(raw?.grandTotal ?? 0).toFixed(2),
      subtotal: Number(raw?.subtotal ?? 0).toFixed(2),
      discountAmount: Number(raw?.discountAmount ?? 0).toFixed(2),
      taxAmount: Number(raw?.taxAmount ?? 0).toFixed(2),
    };
  }

  async byDate(
    companyId: string,
    query: PurchaseReportQueryDto & { allowedBranchIds?: string[] | null },
  ): Promise<PurchaseByDateRow[]> {
    const rows = await this.baseQuery(companyId, query)
      .select('DATE(po.transactionDate)', 'date')
      .addSelect('COUNT(po.id)', 'purchaseOrderCount')
      .addSelect('COALESCE(SUM(po.grandTotal), 0)', 'grandTotal')
      .groupBy('DATE(po.transactionDate)')
      .orderBy('DATE(po.transactionDate)', 'ASC')
      .getRawMany<{
        date: string;
        purchaseOrderCount: string;
        grandTotal: string;
      }>();

    return rows.map((row) => ({
      date: row.date,
      purchaseOrderCount: Number(row.purchaseOrderCount),
      grandTotal: Number(row.grandTotal).toFixed(2),
    }));
  }

  async bySupplier(
    companyId: string,
    query: PurchaseReportQueryDto & { allowedBranchIds?: string[] | null },
  ): Promise<PurchaseBySupplierRow[]> {
    const rows = await this.baseQuery(companyId, query)
      .innerJoin('po.supplier', 'supplier')
      .select('supplier.id', 'supplierId')
      .addSelect('supplier.supplierCode', 'supplierCode')
      .addSelect('supplier.name', 'supplierName')
      .addSelect('COUNT(po.id)', 'purchaseOrderCount')
      .addSelect('COALESCE(SUM(po.grandTotal), 0)', 'grandTotal')
      .groupBy('supplier.id')
      .addGroupBy('supplier.supplierCode')
      .addGroupBy('supplier.name')
      .orderBy('grandTotal', 'DESC')
      .getRawMany<{
        supplierId: string;
        supplierCode: string;
        supplierName: string;
        purchaseOrderCount: string;
        grandTotal: string;
      }>();

    return rows.map((row) => ({
      supplierId: row.supplierId,
      supplierCode: row.supplierCode,
      supplierName: row.supplierName,
      purchaseOrderCount: Number(row.purchaseOrderCount),
      grandTotal: Number(row.grandTotal).toFixed(2),
    }));
  }
}
