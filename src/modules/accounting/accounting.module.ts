import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from './entities/account.entity';
import { CompanyJournalCounter } from './entities/company-journal-counter.entity';
import { FiscalYear } from './entities/fiscal-year.entity';
import { AccountingPeriod } from './entities/accounting-period.entity';
import { JournalEntry } from './entities/journal-entry.entity';
import { JournalEntryLine } from './entities/journal-entry-line.entity';
import { AccountsService } from './services/accounts.service';
import { AccountingPeriodResolverService } from './services/accounting-period-resolver.service';
import { JournalEntriesService } from './services/journal-entries.service';
import { AccountingPostingService } from './services/accounting-posting.service';
import { GeneralLedgerService } from './services/general-ledger.service';
import { TrialBalanceService } from './services/trial-balance.service';
import { AccountsController } from './controllers/accounts.controller';
import { JournalEntriesController } from './controllers/journal-entries.controller';
import { GeneralLedgerController } from './controllers/general-ledger.controller';
import { TrialBalanceController } from './controllers/trial-balance.controller';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { OrganizationModule } from '../organization/organization.module';

/**
 * Phase 17 — Accounting / General Ledger. JournalEntry + JournalEntryLine
 * are the sole accounting source of truth (D1, LOCKED) — no
 * general_ledger/opening_balances/cash_accounts/bank_accounts/tax_accounts
 * table exists anywhere in this module (D23). AccountingPostingService is
 * exported so PaymentsModule can inject it for the one authorized
 * cross-phase call (D13/D19) — PaymentsModule imports AccountingModule
 * rather than AccountingModule importing PaymentsModule, avoiding a
 * circular module dependency (Payment -> Accounting is the only direction;
 * Accounting has zero knowledge of Payment's controllers/DTOs, only of the
 * Payment/PaymentMethod/Customer/Supplier entity shapes it reads via the
 * injected EntityManager).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Account,
      CompanyJournalCounter,
      FiscalYear,
      AccountingPeriod,
      JournalEntry,
      JournalEntryLine,
    ]),
    AuthModule,
    RbacModule,
    OrganizationModule,
  ],
  controllers: [
    AccountsController,
    JournalEntriesController,
    GeneralLedgerController,
    TrialBalanceController,
  ],
  providers: [
    AccountsService,
    AccountingPeriodResolverService,
    JournalEntriesService,
    AccountingPostingService,
    GeneralLedgerService,
    TrialBalanceService,
  ],
  exports: [
    AccountingPostingService,
    JournalEntriesService,
    AccountsService,
    // Phase 22 addition (registration-only): ReportsModule's
    // DashboardService composes the existing TrialBalanceService rather
    // than re-deriving a duplicate balance query — see the locked spec's
    // explicit "do not create duplicate routes/logic if an equivalent
    // service already exists" instruction. No change to TrialBalanceService
    // itself or to TrialBalanceController.
    TrialBalanceService,
  ],
})
export class AccountingModule {}
