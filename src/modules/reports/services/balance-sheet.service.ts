import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JournalEntryLine } from '../../accounting/entities/journal-entry-line.entity';
import { JournalEntryStatus } from '../../accounting/entities/journal-entry-status.enum';
import { AccountType } from '../../accounting/entities/account-type.enum';
import { BalanceSheetQueryDto } from '../dto/balance-sheet-query.dto';
import {
  toCents,
  centsToDecimalString,
} from '../../accounting/utils/double-entry';

export interface BalanceSheetAccountRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  balance: string;
}

export interface BalanceSheetResult {
  asOfDate: string;
  assets: { rows: BalanceSheetAccountRow[]; total: string };
  liabilities: { rows: BalanceSheetAccountRow[]; total: string };
  equity: { rows: BalanceSheetAccountRow[]; total: string };
  totalLiabilitiesAndEquity: string;
  balanced: boolean;
}

/**
 * Balance Sheet (Phase 22). Mirrors TrialBalanceService's query style
 * exactly (locked instruction) — a pure read-query service grouping POSTED
 * JournalEntryLine rows by Account, filtered to Asset/Liability/Equity
 * accountTypes, never a physical `balance_sheet` table. As-of-date,
 * POSTED-only (journalEntry.status = POSTED, journalEntry.entryDate <=
 * asOfDate). Asset balance = debit - credit (assets carry a natural debit
 * balance); Liability/Equity balance = credit - debit (they carry a
 * natural credit balance) — standard accounting sign convention, computed
 * in integer cents (see double-entry.ts's own toCents() docblock for why).
 *
 * `balanced` reports whether Assets == Liabilities + Equity, a genuine
 * structural check (not assumed) — it should always be true given every
 * posted journal individually balances, but is computed and returned
 * explicitly rather than silently assumed, exactly like TrialBalance's own
 * SUM(debit)===SUM(credit) invariant is proven by a dedicated test rather
 * than just asserted in a comment.
 */
@Injectable()
export class BalanceSheetService {
  constructor(
    @InjectRepository(JournalEntryLine)
    private readonly lineRepository: Repository<JournalEntryLine>,
  ) {}

  async query(
    companyId: string,
    query: BalanceSheetQueryDto & { allowedBranchIds?: string[] | null },
  ): Promise<BalanceSheetResult> {
    const asOfDate = query.asOfDate ?? new Date().toISOString().slice(0, 10);

    const qb = this.lineRepository
      .createQueryBuilder('line')
      .innerJoin('line.journalEntry', 'journalEntry')
      .innerJoin('line.account', 'account')
      .where('journalEntry.companyId = :companyId', { companyId })
      .andWhere('journalEntry.status = :status', {
        status: JournalEntryStatus.Posted,
      })
      .andWhere('journalEntry.entryDate <= :asOfDate', { asOfDate })
      .andWhere('account.accountType IN (:...types)', {
        types: [AccountType.Asset, AccountType.Liability, AccountType.Equity],
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

    const assets: BalanceSheetAccountRow[] = [];
    const liabilities: BalanceSheetAccountRow[] = [];
    const equity: BalanceSheetAccountRow[] = [];
    let assetsCents = 0;
    let liabilitiesCents = 0;
    let equityCents = 0;

    for (const row of rawRows) {
      const debitCents = toCents(row.totalDebit);
      const creditCents = toCents(row.totalCredit);
      const isAsset = row.accountType === AccountType.Asset;
      const balanceCents = isAsset
        ? debitCents - creditCents
        : creditCents - debitCents;

      const entry: BalanceSheetAccountRow = {
        accountId: row.accountId,
        accountCode: row.accountCode,
        accountName: row.accountName,
        balance: centsToDecimalString(balanceCents),
      };

      if (row.accountType === AccountType.Asset) {
        assets.push(entry);
        assetsCents += balanceCents;
      } else if (row.accountType === AccountType.Liability) {
        liabilities.push(entry);
        liabilitiesCents += balanceCents;
      } else {
        equity.push(entry);
        equityCents += balanceCents;
      }
    }

    const totalLiabilitiesAndEquityCents = liabilitiesCents + equityCents;

    return {
      asOfDate,
      assets: { rows: assets, total: centsToDecimalString(assetsCents) },
      liabilities: {
        rows: liabilities,
        total: centsToDecimalString(liabilitiesCents),
      },
      equity: { rows: equity, total: centsToDecimalString(equityCents) },
      totalLiabilitiesAndEquity: centsToDecimalString(
        totalLiabilitiesAndEquityCents,
      ),
      balanced: assetsCents === totalLiabilitiesAndEquityCents,
    };
  }
}
