import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { JournalEntry } from '../../accounting/entities/journal-entry.entity';
import { JournalEntryStatus } from '../../accounting/entities/journal-entry-status.enum';
import { Payment } from '../../payments/entities/payment.entity';
import { Sale } from '../../sales/entities/sale.entity';
import { SaleStatus } from '../../sales/entities/sale-status.enum';
import { PurchaseOrder } from '../../purchase/entities/purchase-order.entity';
import { PurchaseOrderStatus } from '../../purchase/entities/purchase-order-status.enum';
import { AccountingAuditLogQueryDto } from '../dto/accounting-audit-log-query.dto';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';

export type AccountingAuditEntityType =
  'JOURNAL_ENTRY' | 'PAYMENT' | 'SALE' | 'PURCHASE_ORDER';

export type AccountingAuditAction = 'CREATED' | 'POSTED' | 'CONFIRMED';

export interface AccountingAuditLogRow {
  entityType: AccountingAuditEntityType;
  entityId: string;
  action: AccountingAuditAction;
  referenceNumber: string;
  performedBy: string | null;
  companyId: string;
  timestamp: Date;
}

export interface PaginatedAccountingAuditLog {
  data: AccountingAuditLogRow[];
  meta: { page: number; limit: number; total: number };
}

/**
 * Accounting Audit Log (Phase 15) — a read projection over already-persisted
 * createdBy/postedBy/createdAt/postedAt/status columns on JournalEntry,
 * Payment, Sale, and PurchaseOrder. Not a new audit-logging system: no new
 * table, no new write path, nothing recorded here that wasn't already a
 * real, durable fact on one of these four entities. Every row's `timestamp`
 * is an actual `createdAt`/`postedAt` value already in the database — never
 * a fabricated or inferred event.
 *
 * Two distinct, real events are surfaced for JournalEntry (CREATED at
 * createdAt, and POSTED at postedAt for entries that reached POSTED) since
 * both are genuinely recorded, separate facts (creator vs poster can
 * differ). Sale/PurchaseOrder only ever expose one row each (CREATED, or
 * CONFIRMED if the status has progressed) — there is no persisted
 * "confirmedAt" timestamp on either entity, so a CONFIRMED sale's action
 * uses its own `updatedAt` as the best-available real timestamp for that
 * status transition, and its `createdBy` as the actor (the only actor
 * column that exists on Sale/PurchaseOrder — there is no separate
 * "confirmedBy" column to report). Payment only ever exposes CREATED (no
 * other status is ever reachable in practice, per PaymentStatus's own
 * docblock).
 *
 * Four independent queries, unioned and sorted in application code — not a
 * single SQL UNION — because the four source tables have materially
 * different shapes (different reference-number columns, different status
 * enums) and each individual query is still itself a bounded, indexed,
 * company-scoped lookup; only the final merge/sort/paginate step touches
 * already-filtered, already-small result sets in memory, not raw
 * unaggregated rows.
 */
@Injectable()
export class AccountingAuditLogService {
  constructor(
    @InjectRepository(JournalEntry)
    private readonly journalEntryRepository: Repository<JournalEntry>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrderRepository: Repository<PurchaseOrder>,
  ) {}

  async query(
    companyId: string,
    query: AccountingAuditLogQueryDto & { allowedBranchIds?: string[] | null },
  ): Promise<PaginatedAccountingAuditLog> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;

    const [journalRows, paymentRows, saleRows, purchaseOrderRows] =
      await Promise.all([
        this.journalEntryRows(companyId, query),
        this.paymentRows(companyId, query),
        this.saleRows(companyId, query),
        this.purchaseOrderRows(companyId, query),
      ]);

    const all = [
      ...journalRows,
      ...paymentRows,
      ...saleRows,
      ...purchaseOrderRows,
    ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const total = all.length;
    const start = (page - 1) * limit;
    const data = all.slice(start, start + limit);

    return { data, meta: { page, limit, total } };
  }

  private applyBranchFilter<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    query: AccountingAuditLogQueryDto & { allowedBranchIds?: string[] | null },
  ): void {
    if (query.branchId) {
      qb.andWhere(`${alias}.branchId = :branchId`, {
        branchId: query.branchId,
      });
    } else if (query.allowedBranchIds?.length) {
      qb.andWhere(`${alias}.branchId IN (:...allowedBranchIds)`, {
        allowedBranchIds: query.allowedBranchIds,
      });
    }
  }

  private async journalEntryRows(
    companyId: string,
    query: AccountingAuditLogQueryDto & { allowedBranchIds?: string[] | null },
  ): Promise<AccountingAuditLogRow[]> {
    const qb = this.journalEntryRepository
      .createQueryBuilder('je')
      .where('je.companyId = :companyId', { companyId });
    this.applyBranchFilter(qb, 'je', query);
    if (query.fromDate) {
      qb.andWhere('je.createdAt >= :fromDate', { fromDate: query.fromDate });
    }
    if (query.toDate) {
      qb.andWhere('je.createdAt <= :toDate', { toDate: query.toDate });
    }

    const entries = await qb
      .select([
        'je.id',
        'je.journalNumber',
        'je.companyId',
        'je.createdBy',
        'je.createdAt',
        'je.postedBy',
        'je.postedAt',
        'je.status',
      ])
      .getMany();

    const rows: AccountingAuditLogRow[] = [];
    for (const entry of entries) {
      rows.push({
        entityType: 'JOURNAL_ENTRY',
        entityId: entry.id,
        action: 'CREATED',
        referenceNumber: entry.journalNumber,
        performedBy: entry.createdBy,
        companyId: entry.companyId,
        timestamp: entry.createdAt,
      });
      if (entry.status === JournalEntryStatus.Posted && entry.postedAt) {
        rows.push({
          entityType: 'JOURNAL_ENTRY',
          entityId: entry.id,
          action: 'POSTED',
          referenceNumber: entry.journalNumber,
          performedBy: entry.postedBy,
          companyId: entry.companyId,
          timestamp: entry.postedAt,
        });
      }
    }
    return rows;
  }

  private async paymentRows(
    companyId: string,
    query: AccountingAuditLogQueryDto & { allowedBranchIds?: string[] | null },
  ): Promise<AccountingAuditLogRow[]> {
    const qb = this.paymentRepository
      .createQueryBuilder('payment')
      .where('payment.companyId = :companyId', { companyId });
    this.applyBranchFilter(qb, 'payment', query);
    if (query.fromDate) {
      qb.andWhere('payment.createdAt >= :fromDate', {
        fromDate: query.fromDate,
      });
    }
    if (query.toDate) {
      qb.andWhere('payment.createdAt <= :toDate', { toDate: query.toDate });
    }

    const payments = await qb
      .select([
        'payment.id',
        'payment.paymentNumber',
        'payment.companyId',
        'payment.createdBy',
        'payment.createdAt',
      ])
      .getMany();

    return payments.map((payment) => ({
      entityType: 'PAYMENT' as const,
      entityId: payment.id,
      action: 'CREATED' as const,
      referenceNumber: payment.paymentNumber,
      performedBy: payment.createdBy,
      companyId: payment.companyId,
      timestamp: payment.createdAt,
    }));
  }

  private async saleRows(
    companyId: string,
    query: AccountingAuditLogQueryDto & { allowedBranchIds?: string[] | null },
  ): Promise<AccountingAuditLogRow[]> {
    const qb = this.saleRepository
      .createQueryBuilder('sale')
      .where('sale.companyId = :companyId', { companyId });
    this.applyBranchFilter(qb, 'sale', query);
    if (query.fromDate) {
      qb.andWhere('sale.createdAt >= :fromDate', { fromDate: query.fromDate });
    }
    if (query.toDate) {
      qb.andWhere('sale.createdAt <= :toDate', { toDate: query.toDate });
    }

    const sales = await qb
      .select([
        'sale.id',
        'sale.saleNumber',
        'sale.companyId',
        'sale.createdBy',
        'sale.createdAt',
        'sale.updatedAt',
        'sale.status',
      ])
      .getMany();

    return sales.map((sale) => ({
      entityType: 'SALE' as const,
      entityId: sale.id,
      action:
        sale.status === SaleStatus.Confirmed
          ? ('CONFIRMED' as const)
          : ('CREATED' as const),
      referenceNumber: sale.saleNumber,
      performedBy: sale.createdBy,
      companyId: sale.companyId,
      timestamp:
        sale.status === SaleStatus.Confirmed ? sale.updatedAt : sale.createdAt,
    }));
  }

  private async purchaseOrderRows(
    companyId: string,
    query: AccountingAuditLogQueryDto & { allowedBranchIds?: string[] | null },
  ): Promise<AccountingAuditLogRow[]> {
    const qb = this.purchaseOrderRepository
      .createQueryBuilder('po')
      .where('po.companyId = :companyId', { companyId });
    this.applyBranchFilter(qb, 'po', query);
    if (query.fromDate) {
      qb.andWhere('po.createdAt >= :fromDate', { fromDate: query.fromDate });
    }
    if (query.toDate) {
      qb.andWhere('po.createdAt <= :toDate', { toDate: query.toDate });
    }

    const purchaseOrders = await qb
      .select([
        'po.id',
        'po.purchaseOrderNumber',
        'po.companyId',
        'po.createdBy',
        'po.createdAt',
        'po.updatedAt',
        'po.status',
      ])
      .getMany();

    return purchaseOrders.map((po) => ({
      entityType: 'PURCHASE_ORDER' as const,
      entityId: po.id,
      action:
        po.status === PurchaseOrderStatus.Confirmed
          ? ('CONFIRMED' as const)
          : ('CREATED' as const),
      referenceNumber: po.purchaseOrderNumber,
      performedBy: po.createdBy,
      companyId: po.companyId,
      timestamp:
        po.status === PurchaseOrderStatus.Confirmed
          ? po.updatedAt
          : po.createdAt,
    }));
  }
}
