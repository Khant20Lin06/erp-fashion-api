import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JournalEntryLine } from '../entities/journal-entry-line.entity';
import { JournalEntryStatus } from '../entities/journal-entry-status.enum';
import { GeneralLedgerQueryDto } from '../dto/general-ledger-query.dto';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';

export interface GeneralLedgerRow {
  journalEntryLineId: string;
  journalEntryId: string;
  journalNumber: string;
  entryDate: Date;
  accountId: string;
  accountCode: string;
  accountName: string;
  debitAmount: string;
  creditAmount: string;
  description: string | null;
  sourceType: string | null;
  sourceId: string | null;
}

export interface PaginatedGeneralLedger {
  data: GeneralLedgerRow[];
  meta: { page: number; limit: number; total: number };
}

/**
 * D5 (LOCKED): pure read-query service over JournalEntryLine (joined to
 * JournalEntry for the POSTED status filter and Account for names) — never
 * a physical `general_ledger` table. Filters JournalEntry.status = POSTED
 * only (D5, D1) — DRAFT/CANCELLED journal lines never appear in the
 * General Ledger, since they are not yet (or never became) real financial
 * facts. Never reads from Payment.amount/Sale.paidAmount/
 * PurchaseOrder.balanceAmount — those are operational data, not accounting
 * source of truth (D5).
 */
@Injectable()
export class GeneralLedgerService {
  constructor(
    @InjectRepository(JournalEntryLine)
    private readonly lineRepository: Repository<JournalEntryLine>,
  ) {}

  async query(
    companyId: string,
    query: GeneralLedgerQueryDto & { allowedBranchIds?: string[] | null },
  ): Promise<PaginatedGeneralLedger> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;

    const qb = this.lineRepository
      .createQueryBuilder('line')
      .innerJoin('line.journalEntry', 'journalEntry')
      .innerJoin('line.account', 'account')
      .where('journalEntry.companyId = :companyId', { companyId })
      .andWhere('journalEntry.status = :status', {
        status: JournalEntryStatus.Posted,
      });

    if (query.accountId) {
      qb.andWhere('line.accountId = :accountId', {
        accountId: query.accountId,
      });
    }
    if (query.branchId) {
      qb.andWhere('journalEntry.branchId = :branchId', {
        branchId: query.branchId,
      });
    } else if (query.allowedBranchIds?.length) {
      qb.andWhere('journalEntry.branchId IN (:...allowedBranchIds)', {
        allowedBranchIds: query.allowedBranchIds,
      });
    }
    if (query.fromDate) {
      qb.andWhere('journalEntry.entryDate >= :fromDate', {
        fromDate: query.fromDate,
      });
    }
    if (query.toDate) {
      qb.andWhere('journalEntry.entryDate <= :toDate', {
        toDate: query.toDate,
      });
    }

    qb.select([
      'line.id AS journalEntryLineId',
      'journalEntry.id AS journalEntryId',
      'journalEntry.journalNumber AS journalNumber',
      'journalEntry.entryDate AS entryDate',
      'account.id AS accountId',
      'account.code AS accountCode',
      'account.name AS accountName',
      'line.debitAmount AS debitAmount',
      'line.creditAmount AS creditAmount',
      'line.description AS description',
      'journalEntry.sourceType AS sourceType',
      'journalEntry.sourceId AS sourceId',
    ])
      .orderBy('journalEntry.entryDate', 'ASC')
      .addOrderBy('journalEntry.journalNumber', 'ASC')
      .offset((page - 1) * limit)
      .limit(limit);

    const [rows, total] = await Promise.all([
      qb.getRawMany<GeneralLedgerRow>(),
      qb.getCount(),
    ]);

    return { data: rows, meta: { page, limit, total } };
  }
}
