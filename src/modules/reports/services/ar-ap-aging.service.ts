import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JournalEntryLine } from '../../accounting/entities/journal-entry-line.entity';
import { JournalEntryStatus } from '../../accounting/entities/journal-entry-status.enum';
import { Customer } from '../../customer-supplier/entities/customer.entity';
import { Supplier } from '../../customer-supplier/entities/supplier.entity';
import { ArApAgingQueryDto } from '../dto/ar-ap-aging-query.dto';

export interface AgingBuckets {
  current: string;
  days1To30: string;
  days31To60: string;
  days61To90: string;
  over90: string;
}

export interface ArAgingRow extends AgingBuckets {
  customerId: string;
  customerCode: string;
  customerName: string;
  total: string;
}

export interface ApAgingRow extends AgingBuckets {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  total: string;
}

export interface ArApAgingResult {
  asOfDate: string;
  receivables: ArAgingRow[];
  payables: ApAgingRow[];
  totalReceivables: string;
  totalPayables: string;
}

interface BucketAccumulator {
  current: number;
  days1To30: number;
  days31To60: number;
  days61To90: number;
  over90: number;
}

function emptyBuckets(): BucketAccumulator {
  return { current: 0, days1To30: 0, days31To60: 0, days61To90: 0, over90: 0 };
}

function bucketFor(ageDays: number): keyof BucketAccumulator {
  if (ageDays <= 0) return 'current';
  if (ageDays <= 30) return 'days1To30';
  if (ageDays <= 60) return 'days31To60';
  if (ageDays <= 90) return 'days61To90';
  return 'over90';
}

function toBucketStrings(acc: BucketAccumulator): AgingBuckets {
  return {
    current: (acc.current / 100).toFixed(2),
    days1To30: (acc.days1To30 / 100).toFixed(2),
    days31To60: (acc.days31To60 / 100).toFixed(2),
    days61To90: (acc.days61To90 / 100).toFixed(2),
    over90: (acc.over90 / 100).toFixed(2),
  };
}

/**
 * New Phase 22 report — AR/AP Aging. Reuses the exact account-resolution
 * pattern AccountingPostingService already uses (Customer.receivableAccountId
 * / Supplier.payableAccountId resolved balances) — never a separate
 * receivable/payable ledger table.
 *
 * Honest scope note: this codebase has no invoice-level open-item tracking
 * (no "which specific Sale/PurchaseOrder remains unpaid" join table) — the
 * only real, evidenced data is each POSTED JournalEntryLine that touches a
 * Customer's receivableAccountId / Supplier's payableAccountId, each with a
 * real entryDate. Aging here is therefore computed per POSTED line
 * (net debit-credit contribution to that account, bucketed by
 * asOfDate - entryDate), not per-invoice — a defensible, real computation
 * from actual source data rather than a fabricated open-item aging model.
 */
@Injectable()
export class ArApAgingService {
  constructor(
    @InjectRepository(JournalEntryLine)
    private readonly lineRepository: Repository<JournalEntryLine>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
  ) {}

  private ageDays(entryDate: string, asOfDate: Date): number {
    const entry = new Date(entryDate);
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.floor((asOfDate.getTime() - entry.getTime()) / msPerDay);
  }

  private async queryReceivables(
    companyId: string,
    asOfDate: Date,
    asOfDateStr: string,
    query: ArApAgingQueryDto & { allowedBranchIds?: string[] | null },
  ): Promise<{ rows: ArAgingRow[]; totalCents: number }> {
    const customers = await this.customerRepository.find({
      where: { companyId },
    });
    const receivableAccountIds = customers
      .filter((c) => c.receivableAccountId)
      .map((c) => c.receivableAccountId as string);

    if (receivableAccountIds.length === 0) {
      return { rows: [], totalCents: 0 };
    }

    const queryBuilder = this.lineRepository
      .createQueryBuilder('line')
      .innerJoin('line.journalEntry', 'journalEntry')
      .where('journalEntry.companyId = :companyId', { companyId })
      .andWhere('journalEntry.status = :status', {
        status: JournalEntryStatus.Posted,
      })
      .andWhere('journalEntry.entryDate <= :asOfDate', {
        asOfDate: asOfDateStr,
      })
      .andWhere('line.accountId IN (:...accountIds)', {
        accountIds: receivableAccountIds,
      });

    if (query.branchId) {
      queryBuilder.andWhere('journalEntry.branchId = :branchId', {
        branchId: query.branchId,
      });
    } else if (query.allowedBranchIds?.length) {
      queryBuilder.andWhere('journalEntry.branchId IN (:...allowedBranchIds)', {
        allowedBranchIds: query.allowedBranchIds,
      });
    }

    const lines = await queryBuilder
      .select([
        'line.accountId AS accountId',
        'line.debitAmount AS debitAmount',
        'line.creditAmount AS creditAmount',
        'journalEntry.entryDate AS entryDate',
      ])
      .getRawMany<{
        accountId: string;
        debitAmount: string;
        creditAmount: string;
        entryDate: string;
      }>();

    const byAccount = new Map<string, BucketAccumulator>();
    let totalCents = 0;
    for (const line of lines) {
      const debitCents = Math.round(Number(line.debitAmount) * 100);
      const creditCents = Math.round(Number(line.creditAmount) * 100);
      const netCents = debitCents - creditCents; // receivable: natural debit balance
      if (netCents === 0) continue;

      const bucket = bucketFor(this.ageDays(line.entryDate, asOfDate));
      const acc = byAccount.get(line.accountId) ?? emptyBuckets();
      acc[bucket] += netCents;
      byAccount.set(line.accountId, acc);
      totalCents += netCents;
    }

    const rows: ArAgingRow[] = customers
      .filter(
        (c) => c.receivableAccountId && byAccount.has(c.receivableAccountId),
      )
      .map((c) => {
        const acc = byAccount.get(c.receivableAccountId as string)!;
        const rowTotalCents =
          acc.current +
          acc.days1To30 +
          acc.days31To60 +
          acc.days61To90 +
          acc.over90;
        return {
          customerId: c.id,
          customerCode: c.customerCode,
          customerName: c.name,
          ...toBucketStrings(acc),
          total: (rowTotalCents / 100).toFixed(2),
        };
      })
      .sort((a, b) => a.customerCode.localeCompare(b.customerCode));

    return { rows, totalCents };
  }

  private async queryPayables(
    companyId: string,
    asOfDate: Date,
    asOfDateStr: string,
    query: ArApAgingQueryDto & { allowedBranchIds?: string[] | null },
  ): Promise<{ rows: ApAgingRow[]; totalCents: number }> {
    const suppliers = await this.supplierRepository.find({
      where: { companyId },
    });
    const payableAccountIds = suppliers
      .filter((s) => s.payableAccountId)
      .map((s) => s.payableAccountId as string);

    if (payableAccountIds.length === 0) {
      return { rows: [], totalCents: 0 };
    }

    const queryBuilder = this.lineRepository
      .createQueryBuilder('line')
      .innerJoin('line.journalEntry', 'journalEntry')
      .where('journalEntry.companyId = :companyId', { companyId })
      .andWhere('journalEntry.status = :status', {
        status: JournalEntryStatus.Posted,
      })
      .andWhere('journalEntry.entryDate <= :asOfDate', {
        asOfDate: asOfDateStr,
      })
      .andWhere('line.accountId IN (:...accountIds)', {
        accountIds: payableAccountIds,
      });

    if (query.branchId) {
      queryBuilder.andWhere('journalEntry.branchId = :branchId', {
        branchId: query.branchId,
      });
    } else if (query.allowedBranchIds?.length) {
      queryBuilder.andWhere('journalEntry.branchId IN (:...allowedBranchIds)', {
        allowedBranchIds: query.allowedBranchIds,
      });
    }

    const lines = await queryBuilder
      .select([
        'line.accountId AS accountId',
        'line.debitAmount AS debitAmount',
        'line.creditAmount AS creditAmount',
        'journalEntry.entryDate AS entryDate',
      ])
      .getRawMany<{
        accountId: string;
        debitAmount: string;
        creditAmount: string;
        entryDate: string;
      }>();

    const byAccount = new Map<string, BucketAccumulator>();
    let totalCents = 0;
    for (const line of lines) {
      const debitCents = Math.round(Number(line.debitAmount) * 100);
      const creditCents = Math.round(Number(line.creditAmount) * 100);
      const netCents = creditCents - debitCents; // payable: natural credit balance
      if (netCents === 0) continue;

      const bucket = bucketFor(this.ageDays(line.entryDate, asOfDate));
      const acc = byAccount.get(line.accountId) ?? emptyBuckets();
      acc[bucket] += netCents;
      byAccount.set(line.accountId, acc);
      totalCents += netCents;
    }

    const rows: ApAgingRow[] = suppliers
      .filter((s) => s.payableAccountId && byAccount.has(s.payableAccountId))
      .map((s) => {
        const acc = byAccount.get(s.payableAccountId as string)!;
        const rowTotalCents =
          acc.current +
          acc.days1To30 +
          acc.days31To60 +
          acc.days61To90 +
          acc.over90;
        return {
          supplierId: s.id,
          supplierCode: s.supplierCode,
          supplierName: s.name,
          ...toBucketStrings(acc),
          total: (rowTotalCents / 100).toFixed(2),
        };
      })
      .sort((a, b) => a.supplierCode.localeCompare(b.supplierCode));

    return { rows, totalCents };
  }

  async query(
    companyId: string,
    query: ArApAgingQueryDto & { allowedBranchIds?: string[] | null },
  ): Promise<ArApAgingResult> {
    const asOfDateStr = query.asOfDate ?? new Date().toISOString().slice(0, 10);
    const asOfDate = new Date(asOfDateStr);

    const [receivables, payables] = await Promise.all([
      this.queryReceivables(companyId, asOfDate, asOfDateStr, query),
      this.queryPayables(companyId, asOfDate, asOfDateStr, query),
    ]);

    return {
      asOfDate: asOfDateStr,
      receivables: receivables.rows,
      payables: payables.rows,
      totalReceivables: (receivables.totalCents / 100).toFixed(2),
      totalPayables: (payables.totalCents / 100).toFixed(2),
    };
  }
}
