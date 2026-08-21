import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Payment } from '../../payments/entities/payment.entity';
import { PaymentDirection } from '../../payments/entities/payment-direction.enum';
import { PaymentMethod } from '../../payments/entities/payment-method.entity';
import { Customer } from '../../customer-supplier/entities/customer.entity';
import { Supplier } from '../../customer-supplier/entities/supplier.entity';
import { Account } from '../entities/account.entity';
import { JournalEntry } from '../entities/journal-entry.entity';
import { JournalSourceType } from '../entities/journal-source-type.enum';
import { JournalReferenceType } from '../entities/journal-reference-type.enum';
import { JournalEntriesService } from './journal-entries.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';

/**
 * Payment -> GL automatic posting (D6/D7/D13, LOCKED — the core piece of
 * Phase 17's cross-phase integration). Every method here accepts the
 * caller's transactional EntityManager and NEVER opens its own transaction
 * (mirrors SalesService.applyPayment()'s / PurchaseOrdersService.
 * applyPayment()'s own contract from Phase 16 exactly) — PaymentsService.
 * create() calls postPayment() as the LAST step inside its existing single
 * TransactionService.run() call, so a posting failure rolls back the
 * entire Payment transaction: no Payment row, no PaymentAllocation row, no
 * Sale/PurchaseOrder balance change, no JournalEntry survives (D7).
 *
 * Payment accounting rules (LOCKED):
 *   RECEIPT: Dr <cash/bank Account from PaymentMethod.glAccountId>
 *            Cr <Customer.receivableAccountId's Account>
 *   PAYMENT: Dr <Supplier.payableAccountId's Account>
 *            Cr <cash/bank Account from PaymentMethod.glAccountId>
 *
 * Fail-closed account-mapping semantics: if PaymentMethod.glAccountId is
 * null, or does not resolve to a real/active/same-company Account, or
 * Customer.receivableAccountId / Supplier.payableAccountId is null or does
 * not resolve to a real/active/same-company Account — the entire Payment
 * transaction fails with ErrorCode.ValidationError (a configuration/setup
 * problem, not a runtime conflict — see class docblock in
 * docs/ACCOUNTING_ARCHITECTURE.md for the ValidationError-vs-Conflict
 * reasoning). No unbalanced or partially-mapped journal, no fallback
 * account, no silent default is ever created.
 */
@Injectable()
export class AccountingPostingService {
  constructor(private readonly journalEntriesService: JournalEntriesService) {}

  /**
   * Resolves and validates the Account a PaymentMethod posts to on the
   * cash/bank side. Fails closed (ValidationError) if glAccountId is null,
   * the account does not exist / belongs to a different company, or is
   * inactive.
   */
  private async resolveCashBankAccount(
    paymentMethod: PaymentMethod,
    companyId: string,
    manager: EntityManager,
  ): Promise<Account> {
    if (!paymentMethod.glAccountId) {
      throw new AppException(
        ErrorCode.ValidationError,
        `Payment method ${paymentMethod.code} has no configured GL account (glAccountId) — cannot post this payment to the General Ledger`,
      );
    }
    const account = await manager.findOne(Account, {
      where: { id: paymentMethod.glAccountId, companyId, isActive: true },
    });
    if (!account) {
      throw new AppException(
        ErrorCode.ValidationError,
        `Payment method ${paymentMethod.code}'s configured GL account does not resolve to an active account in this company`,
      );
    }
    return account;
  }

  /** Resolves and validates Customer.receivableAccountId, failing closed exactly like resolveCashBankAccount(). */
  private async resolveReceivableAccount(
    customer: Customer,
    companyId: string,
    manager: EntityManager,
  ): Promise<Account> {
    if (!customer.receivableAccountId) {
      throw new AppException(
        ErrorCode.ValidationError,
        `Customer ${customer.customerCode} has no configured receivable account (receivableAccountId) — cannot post this payment to the General Ledger`,
      );
    }
    const account = await manager.findOne(Account, {
      where: { id: customer.receivableAccountId, companyId, isActive: true },
    });
    if (!account) {
      throw new AppException(
        ErrorCode.ValidationError,
        `Customer ${customer.customerCode}'s configured receivable account does not resolve to an active account in this company`,
      );
    }
    return account;
  }

  /** Resolves and validates Supplier.payableAccountId, failing closed exactly like resolveCashBankAccount(). */
  private async resolvePayableAccount(
    supplier: Supplier,
    companyId: string,
    manager: EntityManager,
  ): Promise<Account> {
    if (!supplier.payableAccountId) {
      throw new AppException(
        ErrorCode.ValidationError,
        `Supplier ${supplier.supplierCode} has no configured payable account (payableAccountId) — cannot post this payment to the General Ledger`,
      );
    }
    const account = await manager.findOne(Account, {
      where: { id: supplier.payableAccountId, companyId, isActive: true },
    });
    if (!account) {
      throw new AppException(
        ErrorCode.ValidationError,
        `Supplier ${supplier.supplierCode}'s configured payable account does not resolve to an active account in this company`,
      );
    }
    return account;
  }

  /**
   * Posts a just-created Payment to the General Ledger (D7: synchronous,
   * same transaction). Called by PaymentsService.create() as the final
   * step before its transaction commits, after the Payment and
   * PaymentAllocation rows already exist (so sourceId=payment.id is a real,
   * committed-within-this-transaction row by the time the journal
   * references it).
   *
   * D15 idempotency/duplicate-posting-prevention: checks for an existing
   * JournalEntry with (companyId, sourceType=PAYMENT, sourceId=payment.id)
   * before creating one; if found (should not normally happen within a
   * single create() call, but defensive against any future caller reusing
   * this method), returns it instead of creating a duplicate. The
   * UNIQUE(company_id, source_type, source_id) DB constraint is the race
   * backstop — see the try/catch in PaymentsService's own idempotency
   * handling (Phase 16) for the established pattern this mirrors; here the
   * backstop is exercised by the caller catching the constraint violation
   * (see PaymentsService.create()'s own comment at the postPayment() call
   * site).
   */
  async postPayment(
    payment: Payment,
    paymentMethod: PaymentMethod,
    customer: Customer | null,
    supplier: Supplier | null,
    userId: string,
    manager: EntityManager,
  ): Promise<JournalEntry> {
    const existing = await this.journalEntriesService.findBySource(
      payment.companyId,
      JournalSourceType.Payment,
      payment.id,
      manager,
    );
    if (existing) {
      return existing;
    }

    const cashBankAccount = await this.resolveCashBankAccount(
      paymentMethod,
      payment.companyId,
      manager,
    );

    const amount = Number(payment.amount).toFixed(2);

    let debitAccountId: string;
    let creditAccountId: string;

    if (payment.direction === PaymentDirection.Receipt) {
      if (!customer) {
        throw new AppException(
          ErrorCode.ValidationError,
          'RECEIPT payment has no resolved customer — cannot post to the General Ledger',
        );
      }
      const receivableAccount = await this.resolveReceivableAccount(
        customer,
        payment.companyId,
        manager,
      );
      // RECEIPT: Dr cash/bank / Cr receivable
      debitAccountId = cashBankAccount.id;
      creditAccountId = receivableAccount.id;
    } else if (payment.direction === PaymentDirection.Payment) {
      if (!supplier) {
        throw new AppException(
          ErrorCode.ValidationError,
          'PAYMENT payment has no resolved supplier — cannot post to the General Ledger',
        );
      }
      const payableAccount = await this.resolvePayableAccount(
        supplier,
        payment.companyId,
        manager,
      );
      // PAYMENT: Dr payable / Cr cash/bank
      debitAccountId = payableAccount.id;
      creditAccountId = cashBankAccount.id;
    } else {
      // REFUND (Returns/Discounts/Loyalty phase): BLOCKED, not
      // fabricated. A refund's correct debit side is a Sales Returns /
      // contra-revenue account (Dr Sales Returns, Cr Cash/Bank) — never
      // Customer.receivableAccountId, which represents "amount the
      // customer owes us" and has no honest meaning here (the receivable
      // was already settled by the original Sale/Payment; a refund does
      // not reopen it). No salesReturnAccountId or equivalent mapping
      // field exists anywhere in this codebase (confirmed by audit: grep
      // across every entity for "AccountId" found only glAccountId/
      // receivableAccountId/payableAccountId). Fabricating a reuse of
      // receivableAccountId here would silently misclassify the GL entry.
      // The Payment/PaymentAllocation/SaleReturn.refundedAmount side of a
      // refund is fully implemented and correct; only its GL posting is
      // blocked pending a genuinely new account-mapping field.
      throw new AppException(
        ErrorCode.UnprocessableEntity,
        'REFUND payments cannot be posted to the General Ledger: no sales-return/contra-revenue account mapping exists in this codebase (see AccountingPostingService.postPayment() REFUND branch). The refund itself is still recorded (Payment + SaleReturn.refundedAmount); accounting posting is BLOCKED until a dedicated account-mapping field is added in a future phase.',
      );
    }

    try {
      return await this.journalEntriesService.createInternal({
        companyId: payment.companyId,
        branchId: payment.branchId,
        entryDate: payment.paymentDate,
        description: `Payment ${payment.paymentNumber} (${payment.direction})`,
        sourceType: JournalSourceType.Payment,
        sourceId: payment.id,
        userId,
        manager,
        lines: [
          {
            accountId: debitAccountId,
            debitAmount: amount,
            creditAmount: '0.00',
            referenceType: JournalReferenceType.Payment,
            referenceId: payment.id,
            description: `Payment ${payment.paymentNumber}`,
          },
          {
            accountId: creditAccountId,
            debitAmount: '0.00',
            creditAmount: amount,
            referenceType: JournalReferenceType.Payment,
            referenceId: payment.id,
            description: `Payment ${payment.paymentNumber}`,
          },
        ],
      });
    } catch (error) {
      // D15 (LOCKED) race backstop: mirrors PaymentsService's own
      // idempotency race-handling (Phase 16) exactly — catch the DB-level
      // UNIQUE(company_id, source_type, source_id) violation and re-fetch
      // the winning row instead of erroring out or creating a duplicate.
      // In practice this specific race cannot occur for
      // sourceId=payment.id (a brand-new UUID unique to this Payment row,
      // never reused across calls), but createInternal() /
      // findBySource() are also the mechanism any future non-Payment
      // caller would reuse, so the backstop is implemented at this shared
      // layer rather than assumed away.
      if (this.isDuplicateSourceError(error)) {
        const existing = await this.journalEntriesService.findBySource(
          payment.companyId,
          JournalSourceType.Payment,
          payment.id,
          manager,
        );
        if (existing) {
          return existing;
        }
      }
      throw error;
    }
  }

  private isDuplicateSourceError(error: unknown): boolean {
    const err = error as {
      code?: string;
      errno?: number;
      driverError?: { code?: string; errno?: number };
      message?: string;
    };
    const code = err?.code ?? err?.driverError?.code;
    const errno = err?.errno ?? err?.driverError?.errno;
    const isDuplicateEntry = code === 'ER_DUP_ENTRY' || errno === 1062;
    if (!isDuplicateEntry) {
      return false;
    }
    // Narrow to the source-uniqueness index specifically (named
    // IDX_je_company_source below in the migration) so an unrelated
    // duplicate-key failure (e.g. a journal-number collision, which
    // should never happen given the counter lock, but defensively) is
    // never silently swallowed as if it were a duplicate-posting replay.
    return (err?.message ?? '').includes('source');
  }
}
