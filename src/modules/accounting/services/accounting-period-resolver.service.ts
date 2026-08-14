import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { FiscalYear } from '../entities/fiscal-year.entity';
import { AccountingPeriod } from '../entities/accounting-period.entity';
import { FiscalYearStatus } from '../entities/fiscal-year-status.enum';
import { AccountingPeriodStatus } from '../entities/accounting-period-status.enum';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * D10 (LOCKED, implementation-detail judgment call — the locked spec
 * explicitly delegates this): "you will need to decide how a
 * period/fiscal-year gets created in the first place... no POST endpoint
 * is listed (D22)."
 *
 * DECISION: lazy auto-creation (spec's own option (a)). The first time any
 * journal entry (manual via POST /journal-entries, or automatic via
 * Payment posting) needs to resolve an AccountingPeriod for a
 * (companyId, entryDate) pair and no FiscalYear/AccountingPeriod row
 * covers that date yet, this service creates a calendar-year FiscalYear
 * (Jan 1 - Dec 31 of entryDate's year, status OPEN) and one matching
 * full-year AccountingPeriod (status OPEN) for it, transactionally, inside
 * the caller's own manager — never opening a second transaction (mirrors
 * every other Phase 17 service's manager-passthrough discipline, D13).
 *
 * Rationale for lazy-creation over "pre-seeded only": D22's locked API
 * surface has no POST /fiscal-years or POST /accounting-periods endpoint,
 * and the locked spec requires posting to actually work end-to-end
 * (Payment->GL, POST /journal-entries/:id/post) without inventing an
 * unlisted endpoint. A purely pre-seeded requirement would leave both of
 * those locked, listed endpoints permanently broken for any company that
 * has not been manually seeded through direct DB access — which is not a
 * real operational path. Lazy creation is bounded and safe: at most one
 * FiscalYear+AccountingPeriod pair is created per (company, calendar year)
 * ever (a second call for a date in the same year finds the existing
 * period and returns it, never creates a duplicate — verified by a
 * dedicated test). This does not implement any "automatic closing
 * workflow" (D10 explicitly forbids that) — it only ever creates OPEN
 * periods on first use; closing/locking remains entirely manual, done by
 * direct data administration since no PATCH endpoint for FiscalYear/
 * AccountingPeriod exists either (D22 lists none) — consistent with the
 * locked instruction to keep this minimal.
 */
@Injectable()
export class AccountingPeriodResolverService {
  /**
   * Resolves the OPEN AccountingPeriod (under an OPEN FiscalYear) covering
   * `entryDate` for `companyId`, lazily creating a calendar-year
   * FiscalYear+AccountingPeriod pair if none exists yet. Rejects (409) if
   * a covering period exists but is LOCKED, or its FiscalYear is CLOSED —
   * posting into a locked period must be rejected, never silently
   * redirected (D10, LOCKED).
   */
  async resolveOpenPeriod(
    companyId: string,
    entryDate: Date,
    manager: EntityManager,
  ): Promise<AccountingPeriod> {
    const dateOnly = toDateOnly(entryDate);

    const existing = await manager
      .createQueryBuilder(AccountingPeriod, 'period')
      .innerJoinAndSelect('period.fiscalYear', 'fiscalYear')
      .where('fiscalYear.companyId = :companyId', { companyId })
      .andWhere('period.startDate <= :dateOnly', { dateOnly })
      .andWhere('period.endDate >= :dateOnly', { dateOnly })
      .getOne();

    if (existing) {
      if (existing.fiscalYear?.status === FiscalYearStatus.Closed) {
        throw new AppException(
          ErrorCode.Conflict,
          'Cannot post into a period whose fiscal year is CLOSED',
        );
      }
      if (existing.status === AccountingPeriodStatus.Locked) {
        throw new AppException(
          ErrorCode.Conflict,
          'Cannot post into a LOCKED accounting period',
        );
      }
      return existing;
    }

    // No covering period exists yet — lazily create a calendar-year
    // FiscalYear + full-year AccountingPeriod for this company/year.
    const year = entryDate.getUTCFullYear();
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    // Re-check for a race: two concurrent postings for the same
    // (company, year) with no prior period could both reach here. Guard
    // with a second lookup scoped to the exact calendar-year window right
    // before insert; if a concurrent transaction already committed one,
    // use it. This is a best-effort race guard (not a hard DB constraint
    // beyond the natural row lookup) consistent with this being a lazily
    // materialized default, not a contended hot path like document
    // numbering.
    const raceCheck = await manager
      .createQueryBuilder(AccountingPeriod, 'period')
      .innerJoinAndSelect('period.fiscalYear', 'fiscalYear')
      .where('fiscalYear.companyId = :companyId', { companyId })
      .andWhere('period.startDate = :yearStart', { yearStart })
      .andWhere('period.endDate = :yearEnd', { yearEnd })
      .getOne();
    if (raceCheck) {
      return raceCheck;
    }

    const fiscalYear = manager.create(FiscalYear, {
      companyId,
      name: `FY${year}`,
      startDate: yearStart,
      endDate: yearEnd,
      status: FiscalYearStatus.Open,
    });
    const savedFiscalYear = await manager.save(FiscalYear, fiscalYear);

    const period = manager.create(AccountingPeriod, {
      fiscalYearId: savedFiscalYear.id,
      name: `FY${year}`,
      startDate: yearStart,
      endDate: yearEnd,
      status: AccountingPeriodStatus.Open,
    });
    const savedPeriod = await manager.save(AccountingPeriod, period);
    savedPeriod.fiscalYear = savedFiscalYear;
    return savedPeriod;
  }
}
