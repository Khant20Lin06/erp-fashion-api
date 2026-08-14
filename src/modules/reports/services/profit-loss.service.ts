import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JournalEntryLine } from '../../accounting/entities/journal-entry-line.entity';
import { JournalEntryStatus } from '../../accounting/entities/journal-entry-status.enum';
import { AccountType } from '../../accounting/entities/account-type.enum';
import { ProfitLossQueryDto } from '../dto/profit-loss-query.dto';
import {
  toCents,
  centsToDecimalString,
} from '../../accounting/utils/double-entry';

export interface ProfitLossAccountRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  amount: string;
}

export interface ProfitLossResult {
  fromDate: string | null;
  toDate: string | null;
  revenue: { rows: ProfitLossAccountRow[]; total: string };
  expense: { rows: ProfitLossAccountRow[]; total: string };
  netIncome: string;
}

/**
 * Profit & Loss (Phase 22). Mirrors TrialBalanceService's query style
 * exactly (locked instruction) — a pure read-query service grouping POSTED
 * JournalEntryLine rows by Account, filtered to Revenue/Expense
 * accountTypes, date-range, never a physical `profit_loss` table. Revenue
 * amount = credit - debit (natural credit balance); Expense amount = debit
 * - credit (natural debit balance) — standard accounting sign convention.
 * netIncome = totalRevenue - totalExpense, computed in integer cents.
 *
 * No COGS/gross-profit line (explicit locked out-of-scope: Inventory
 * Valuation/COGS is deferred — see Known Limitations) — this report only
 * ever shows what the GL itself actually contains (Revenue/Expense account
 * activity), which in this codebase's current posting flow is limited to
 * whatever a future phase's Revenue/Expense-posting logic would produce;
 * today only Payment posts automatically (to Asset/Liability accounts, per
 * AccountingPostingService), so a Revenue/Expense line only ever appears
 * here if a manual journal entry created one (D12's manual journal entry
 * capability, Phase 17) — documented honestly rather than fabricated.
 */
@Injectable()
export class ProfitLossService {
  constructor(
    @InjectRepository(JournalEntryLine)
    private readonly lineRepository: Repository<JournalEntryLine>,
  ) {}

  async query(
    companyId: string,
    query: ProfitLossQueryDto & { allowedBranchIds?: string[] | null },
  ): Promise<ProfitLossResult> {
    const qb = this.lineRepository
      .createQueryBuilder('line')
      .innerJoin('line.journalEntry', 'journalEntry')
      .innerJoin('line.account', 'account')
      .where('journalEntry.companyId = :companyId', { companyId })
      .andWhere('journalEntry.status = :status', {
        status: JournalEntryStatus.Posted,
      })
      .andWhere('account.accountType IN (:...types)', {
        types: [AccountType.Revenue, AccountType.Expense],
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
      accountType: AccountType;
      totalDebit: string;
      totalCredit: string;
    }>();

    const revenue: ProfitLossAccountRow[] = [];
    const expense: ProfitLossAccountRow[] = [];
    let revenueCents = 0;
    let expenseCents = 0;

    for (const row of rawRows) {
      const debitCents = toCents(row.totalDebit);
      const creditCents = toCents(row.totalCredit);
      const isRevenue = row.accountType === AccountType.Revenue;
      const amountCents = isRevenue
        ? creditCents - debitCents
        : debitCents - creditCents;

      const entry: ProfitLossAccountRow = {
        accountId: row.accountId,
        accountCode: row.accountCode,
        accountName: row.accountName,
        amount: centsToDecimalString(amountCents),
      };

      if (isRevenue) {
        revenue.push(entry);
        revenueCents += amountCents;
      } else {
        expense.push(entry);
        expenseCents += amountCents;
      }
    }

    return {
      fromDate: query.fromDate ?? null,
      toDate: query.toDate ?? null,
      revenue: { rows: revenue, total: centsToDecimalString(revenueCents) },
      expense: { rows: expense, total: centsToDecimalString(expenseCents) },
      netIncome: centsToDecimalString(revenueCents - expenseCents),
    };
  }
}
