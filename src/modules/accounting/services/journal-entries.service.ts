import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { EntityManager, Repository } from 'typeorm';
import { JournalEntry } from '../entities/journal-entry.entity';
import { JournalEntryLine } from '../entities/journal-entry-line.entity';
import { JournalEntryStatus } from '../entities/journal-entry-status.enum';
import { JournalSourceType } from '../entities/journal-source-type.enum';
import { JournalReferenceType } from '../entities/journal-reference-type.enum';
import { CompanyJournalCounter } from '../entities/company-journal-counter.entity';
import { Account } from '../entities/account.entity';
import { AccountingPeriod } from '../entities/accounting-period.entity';
import { FiscalYear } from '../entities/fiscal-year.entity';
import { FiscalYearStatus } from '../entities/fiscal-year-status.enum';
import { AccountingPeriodStatus } from '../entities/accounting-period-status.enum';
import { CreateJournalEntryDto } from '../dto/create-journal-entry.dto';
import { ListJournalEntriesDto } from '../dto/list-journal-entries.dto';
import { AccountingPeriodResolverService } from './accounting-period-resolver.service';
import { assertBalanced } from '../utils/double-entry';
import { formatDocumentNumber } from '../../inventory/utils/document-number';
import { retryOnDuplicateEntry } from '../../inventory/utils/upsert-retry';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { CompaniesService } from '../../organization/services/companies.service';
import { BranchesService } from '../../organization/services/branches.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { resolveSortField } from '../../../shared/dto/resolve-sort-field';

export interface PaginatedJournalEntries {
  data: JournalEntry[];
  meta: { page: number; limit: number; total: number };
}

const SORTABLE_FIELDS = [
  'createdAt',
  'entryDate',
  'journalNumber',
  'status',
] as const;

/**
 * Manual journal entry domain service (D12, LOCKED). D1: JournalEntry +
 * JournalEntryLine are the sole accounting source of truth. D2: DRAFT ->
 * POSTED (terminal) lifecycle, with DRAFT -> CANCELLED also available (see
 * journal-entry-status.enum.ts's docblock for why this differs from
 * Payment's own D4 lifecycle decision in Phase 16). D3: POSTED journals are
 * immutable — no update/delete method exists on this service at all for a
 * POSTED entry.
 */
@Injectable()
export class JournalEntriesService {
  constructor(
    @InjectRepository(JournalEntry)
    private readonly journalEntryRepository: Repository<JournalEntry>,
    private readonly transactionService: TransactionService,
    private readonly companiesService: CompaniesService,
    private readonly branchesService: BranchesService,
    private readonly periodResolver: AccountingPeriodResolverService,
  ) {}

  async findAll(
    companyId: string,
    query: ListJournalEntriesDto,
  ): Promise<PaginatedJournalEntries> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const sortField = resolveSortField(
      query.sort,
      SORTABLE_FIELDS,
      'createdAt',
    );

    const qb = this.journalEntryRepository
      .createQueryBuilder('journalEntry')
      .where('journalEntry.companyId = :companyId', { companyId });

    if (query.branchId) {
      qb.andWhere('journalEntry.branchId = :branchId', {
        branchId: query.branchId,
      });
    }
    if (query.status) {
      qb.andWhere('journalEntry.status = :status', { status: query.status });
    }
    if (query.sourceType) {
      qb.andWhere('journalEntry.sourceType = :sourceType', {
        sourceType: query.sourceType,
      });
    }
    if (query.sourceId) {
      qb.andWhere('journalEntry.sourceId = :sourceId', {
        sourceId: query.sourceId,
      });
    }
    if (query.search) {
      qb.andWhere('journalEntry.journalNumber LIKE :search', {
        search: `%${query.search}%`,
      });
    }

    qb.orderBy(`journalEntry.${sortField}`, query.order ?? 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { page, limit, total } };
  }

  async findByIdInCompany(
    id: string,
    companyId: string,
  ): Promise<JournalEntry> {
    const entry = await this.journalEntryRepository.findOne({
      where: { id, companyId },
      relations: { lines: true },
    });
    if (!entry) {
      throw new AppException(ErrorCode.NotFound, 'Journal entry not found');
    }
    return entry;
  }

  /**
   * Locks (SELECT ... FOR UPDATE) and increments the company's per-year
   * journal-number counter inside the caller's transaction — the exact
   * company_payment_counters/company_sale_counters pattern (Phase 12-16)
   * applied here.
   */
  async generateJournalNumber(
    companyId: string,
    year: number,
    manager: EntityManager,
  ): Promise<string> {
    await retryOnDuplicateEntry(() =>
      manager.query(
        'INSERT INTO `company_journal_counters` (`id`, `company_id`, `year`, `last_sequence`) ' +
          'VALUES (?, ?, ?, 0) ' +
          'ON DUPLICATE KEY UPDATE `last_sequence` = `last_sequence`',
        [randomUUID(), companyId, year],
      ),
    );

    const counter = await manager
      .createQueryBuilder(CompanyJournalCounter, 'counter')
      .where('counter.companyId = :companyId', { companyId })
      .andWhere('counter.year = :year', { year })
      .setLock('pessimistic_write')
      .getOneOrFail();

    const nextSequence = counter.lastSequence + 1;
    // manager.update() rather than manager.save() — see
    // PaymentsService.generatePaymentNumber()'s comment (Phase 16) for the
    // exact bug class this avoids (save() on a lock-hydrated entity can
    // issue a duplicate INSERT instead of an UPDATE under concurrency).
    await manager.update(CompanyJournalCounter, counter.id, {
      lastSequence: nextSequence,
    });
    return formatDocumentNumber('JE', year, nextSequence);
  }

  /**
   * Validates every line's accountId exists, is active, and belongs to the
   * resolved company — never trusts a client-supplied accountId beyond
   * using it as a lookup key (the same "never trust, always
   * findByIdInCompany" convention every phase since 07 established).
   */
  private async assertLinesReferenceValidAccounts(
    lines: CreateJournalEntryDto['lines'],
    companyId: string,
    manager: EntityManager,
  ): Promise<void> {
    for (const line of lines) {
      const account = await manager.findOne(Account, {
        where: { id: line.accountId, companyId },
      });
      if (!account) {
        throw new AppException(
          ErrorCode.ValidationError,
          `accountId ${line.accountId} does not reference an account in this company`,
        );
      }
      if (!account.isActive) {
        throw new AppException(
          ErrorCode.ValidationError,
          `accountId ${line.accountId} references an inactive account`,
        );
      }
    }
  }

  /**
   * Creates a JournalEntry + its JournalEntryLines as DRAFT (D12/D2,
   * LOCKED) — balance is NOT enforced here (a draft may legitimately be
   * unbalanced while a user is still building it); it is enforced at
   * post() time. sourceType is always MANUAL for entries created through
   * this public API — PAYMENT-sourced entries are only ever created by
   * AccountingPostingService.postPayment(), which uses the internal
   * createInternal() method below instead, participating in the caller's
   * own transaction (D13).
   */
  async create(
    companyId: string,
    userId: string,
    dto: CreateJournalEntryDto,
  ): Promise<JournalEntry> {
    const company = await this.companiesService.findActiveByIdOrNull(companyId);
    if (!company) {
      throw new AppException(
        ErrorCode.ValidationError,
        'companyId does not reference an active company',
      );
    }

    if (dto.branchId) {
      const branch = await this.branchesService.findActiveByIdOrNull(
        dto.branchId,
      );
      if (!branch) {
        throw new AppException(
          ErrorCode.ValidationError,
          'branchId does not reference an active branch',
        );
      }
      if (branch.companyId !== companyId) {
        throw new AppException(
          ErrorCode.ValidationError,
          'branchId does not belong to the resolved company',
        );
      }
    }

    const entryDate = dto.entryDate ? new Date(dto.entryDate) : new Date();

    return this.transactionService.run(async (manager) => {
      await this.assertLinesReferenceValidAccounts(
        dto.lines,
        companyId,
        manager,
      );

      const period = await this.periodResolver.resolveOpenPeriod(
        companyId,
        entryDate,
        manager,
      );

      const year = entryDate.getUTCFullYear();
      const journalNumber = await this.generateJournalNumber(
        companyId,
        year,
        manager,
      );

      // Draft totals are a best-effort cache of the (possibly unbalanced)
      // current line totals — always re-derived and re-validated at
      // post() time, never trusted on their own (LOCKED spec).
      let totalDebitCents = 0;
      let totalCreditCents = 0;
      for (const line of dto.lines) {
        totalDebitCents += Math.round(Number(line.debitAmount) * 100);
        totalCreditCents += Math.round(Number(line.creditAmount) * 100);
      }

      const journalEntry = manager.create(JournalEntry, {
        journalNumber,
        companyId,
        branchId: dto.branchId ?? null,
        accountingPeriodId: period.id,
        entryDate,
        status: JournalEntryStatus.Draft,
        sourceType: JournalSourceType.Manual,
        sourceId: null,
        description: dto.description,
        totalDebit: (totalDebitCents / 100).toFixed(2),
        totalCredit: (totalCreditCents / 100).toFixed(2),
        createdBy: userId,
        postedBy: null,
        postedAt: null,
      });
      const savedEntry = await manager.save(JournalEntry, journalEntry);

      for (const line of dto.lines) {
        const lineRow = manager.create(JournalEntryLine, {
          journalEntryId: savedEntry.id,
          accountId: line.accountId,
          debitAmount: Number(line.debitAmount).toFixed(2),
          creditAmount: Number(line.creditAmount).toFixed(2),
          referenceType: line.referenceType ?? null,
          referenceId: line.referenceId ?? null,
          description: line.description ?? null,
        });
        await manager.save(JournalEntryLine, lineRow);
      }

      savedEntry.lines = await manager.find(JournalEntryLine, {
        where: { journalEntryId: savedEntry.id },
      });
      return savedEntry;
    });
  }

  /**
   * DRAFT -> POSTED (D2/D12, LOCKED). Re-derives and validates the
   * double-entry balance from the actual JournalEntryLine rows (never
   * trusting the cached totalDebit/totalCredit), resolves/validates the
   * accounting period is still OPEN (a period could have been locked
   * between draft creation and posting), and stamps postedBy/postedAt.
   * POSTED is terminal — this method rejects (409) if the entry is not
   * currently DRAFT.
   */
  async post(
    id: string,
    companyId: string,
    userId: string,
  ): Promise<JournalEntry> {
    return this.transactionService.run(async (manager) => {
      const entry = await manager
        .createQueryBuilder(JournalEntry, 'journalEntry')
        .where('journalEntry.id = :id', { id })
        .andWhere('journalEntry.companyId = :companyId', { companyId })
        .setLock('pessimistic_write')
        .getOne();

      if (!entry) {
        throw new AppException(ErrorCode.NotFound, 'Journal entry not found');
      }
      if (entry.status !== JournalEntryStatus.Draft) {
        throw new AppException(
          ErrorCode.Conflict,
          `Cannot post a journal entry with status ${entry.status} (only DRAFT can be posted)`,
        );
      }

      const lines = await manager.find(JournalEntryLine, {
        where: { journalEntryId: id },
      });
      const { totalDebit, totalCredit } = assertBalanced(lines);

      // Re-validate the period is still postable — it may have been
      // locked, or its fiscal year closed, between draft creation and now.
      const period = await manager.findOneOrFail(AccountingPeriod, {
        where: { id: entry.accountingPeriodId },
      });
      const fiscalYear = await manager.findOneOrFail(FiscalYear, {
        where: { id: period.fiscalYearId },
      });
      if (fiscalYear.status === FiscalYearStatus.Closed) {
        throw new AppException(
          ErrorCode.Conflict,
          'Cannot post into a period whose fiscal year is CLOSED',
        );
      }
      if (period.status === AccountingPeriodStatus.Locked) {
        throw new AppException(
          ErrorCode.Conflict,
          'Cannot post into a LOCKED accounting period',
        );
      }

      const now = new Date();
      await manager.update(JournalEntry, id, {
        status: JournalEntryStatus.Posted,
        totalDebit,
        totalCredit,
        postedBy: userId,
        postedAt: now,
      });

      const updated = await manager.findOneOrFail(JournalEntry, {
        where: { id },
      });
      updated.lines = lines;
      return updated;
    });
  }

  /** DRAFT -> CANCELLED only (see journal-entry-status.enum.ts's docblock). */
  async cancel(id: string, companyId: string): Promise<JournalEntry> {
    const entry = await this.findByIdInCompany(id, companyId);
    if (entry.status !== JournalEntryStatus.Draft) {
      throw new AppException(
        ErrorCode.Conflict,
        `Cannot cancel a journal entry with status ${entry.status} (only DRAFT can be cancelled)`,
      );
    }
    entry.status = JournalEntryStatus.Cancelled;
    return this.journalEntryRepository.save(entry);
  }

  /**
   * Internal creation path for automatic (Payment) posting (D6/D7/D13,
   * LOCKED) — participates in the CALLER's transaction/manager, never
   * opens its own (mirrors SalesService.applyPayment()'s own contract from
   * Phase 16). Creates the JournalEntry directly as POSTED (an automatic
   * posting has no draft-review step — the locked spec's Payment accounting
   * rules describe a single atomic Dr/Cr posting, not a two-step
   * draft-then-post flow) with the given sourceType/sourceId, after
   * validating the balance via assertBalanced(). Used exclusively by
   * AccountingPostingService.postPayment() — never exposed through any
   * controller.
   */
  async createInternal(params: {
    companyId: string;
    branchId: string | null;
    entryDate: Date;
    description: string;
    sourceType: JournalSourceType;
    sourceId: string;
    userId: string;
    lines: Array<{
      accountId: string;
      debitAmount: string;
      creditAmount: string;
      referenceType?: JournalReferenceType;
      referenceId?: string;
      description?: string;
    }>;
    manager: EntityManager;
  }): Promise<JournalEntry> {
    const { manager } = params;
    const { totalDebit, totalCredit } = assertBalanced(params.lines);

    const period = await this.periodResolver.resolveOpenPeriod(
      params.companyId,
      params.entryDate,
      manager,
    );

    const year = params.entryDate.getUTCFullYear();
    const journalNumber = await this.generateJournalNumber(
      params.companyId,
      year,
      manager,
    );

    const now = new Date();
    const journalEntry = manager.create(JournalEntry, {
      journalNumber,
      companyId: params.companyId,
      branchId: params.branchId,
      accountingPeriodId: period.id,
      entryDate: params.entryDate,
      status: JournalEntryStatus.Posted,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      description: params.description,
      totalDebit,
      totalCredit,
      createdBy: params.userId,
      postedBy: params.userId,
      postedAt: now,
    });
    const savedEntry = await manager.save(JournalEntry, journalEntry);

    for (const line of params.lines) {
      const lineRow = manager.create(JournalEntryLine, {
        journalEntryId: savedEntry.id,
        accountId: line.accountId,
        debitAmount: Number(line.debitAmount).toFixed(2),
        creditAmount: Number(line.creditAmount).toFixed(2),
        referenceType: line.referenceType ?? null,
        referenceId: line.referenceId ?? null,
        description: line.description ?? null,
      });
      await manager.save(JournalEntryLine, lineRow);
    }

    savedEntry.lines = await manager.find(JournalEntryLine, {
      where: { journalEntryId: savedEntry.id },
    });
    return savedEntry;
  }

  /**
   * D15 (LOCKED) idempotency/duplicate-posting-prevention lookup: finds an
   * existing journal by (companyId, sourceType, sourceId), used by
   * AccountingPostingService.postPayment() before creating a new one, and
   * as the race-backstop re-fetch after a UNIQUE(company_id, source_type,
   * source_id) violation.
   */
  async findBySource(
    companyId: string,
    sourceType: JournalSourceType,
    sourceId: string,
    manager: EntityManager,
  ): Promise<JournalEntry | null> {
    return manager.findOne(JournalEntry, {
      where: { companyId, sourceType, sourceId },
      relations: { lines: true },
    });
  }
}
