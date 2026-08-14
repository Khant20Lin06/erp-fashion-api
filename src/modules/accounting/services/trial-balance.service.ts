import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JournalEntryLine } from '../entities/journal-entry-line.entity';
import { JournalEntryStatus } from '../entities/journal-entry-status.enum';
import { TrialBalanceQueryDto } from '../dto/trial-balance-query.dto';

export interface TrialBalanceRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  totalDebit: string;
  totalCredit: string;
}

export interface TrialBalanceResult {
  rows: TrialBalanceRow[];
  totalDebit: string;
  totalCredit: string;
}

/**
 * D5 (LOCKED): pure read-query service, grouping POSTED JournalEntryLine
 * rows by Account — never a physical `trial_balance` table. SUM(debit) ===
 * SUM(credit) globally is a structural invariant here (every posted
 * journal individually balances per D-spec's own enforcement at posting
 * time, so the sum across all of them balances too) — proven by a
 * dedicated e2e test rather than merely asserted.
 */
@Injectable()
export class TrialBalanceService {
  constructor(
    @InjectRepository(JournalEntryLine)
    private readonly lineRepository: Repository<JournalEntryLine>,
  ) {}

  async query(
    companyId: string,
    query: TrialBalanceQueryDto & { allowedBranchIds?: string[] | null },
  ): Promise<TrialBalanceResult> {
    const qb = this.lineRepository
      .createQueryBuilder('line')
      .innerJoin('line.journalEntry', 'journalEntry')
      .innerJoin('line.account', 'account')
      .where('journalEntry.companyId = :companyId', { companyId })
      .andWhere('journalEntry.status = :status', {
        status: JournalEntryStatus.Posted,
      });

    if (query.branchId) {
      qb.andWhere('journalEntry.branchId = :branchId', {
        branchId: query.branchId,
      });
    } else if (query.allowedBranchIds?.length) {
      qb.andWhere('journalEntry.branchId IN (:...allowedBranchIds)', {
        allowedBranchIds: query.allowedBranchIds,
      });
    }

    if (query.asOfDate) {
      qb.andWhere('journalEntry.entryDate <= :asOfDate', {
        asOfDate: query.asOfDate,
      });
    }

    qb.select([
      'account.id AS accountId',
      'account.code AS accountCode',
      'account.name AS accountName',
      'account.accountType AS accountType',
      'COALESCE(SUM(line.debitAmount), 0) AS totalDebit',
      'COALESCE(SUM(line.creditAmount), 0) AS totalCredit',
    ])
      .groupBy('account.id')
      .addGroupBy('account.code')
      .addGroupBy('account.name')
      .addGroupBy('account.accountType')
      .orderBy('account.code', 'ASC');

    const rawRows = await qb.getRawMany<{
      accountId: string;
      accountCode: string;
      accountName: string;
      accountType: string;
      totalDebit: string;
      totalCredit: string;
    }>();

    let totalDebitCents = 0;
    let totalCreditCents = 0;
    const rows: TrialBalanceRow[] = rawRows.map((row) => {
      totalDebitCents += Math.round(Number(row.totalDebit) * 100);
      totalCreditCents += Math.round(Number(row.totalCredit) * 100);
      return {
        accountId: row.accountId,
        accountCode: row.accountCode,
        accountName: row.accountName,
        accountType: row.accountType,
        totalDebit: Number(row.totalDebit).toFixed(2),
        totalCredit: Number(row.totalCredit).toFixed(2),
      };
    });

    return {
      rows,
      totalDebit: (totalDebitCents / 100).toFixed(2),
      totalCredit: (totalCreditCents / 100).toFixed(2),
    };
  }
}
