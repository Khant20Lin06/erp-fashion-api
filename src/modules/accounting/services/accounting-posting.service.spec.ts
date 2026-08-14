import { EntityManager } from 'typeorm';
import { AccountingPostingService } from './accounting-posting.service';
import { JournalEntriesService } from './journal-entries.service';
import { Payment } from '../../payments/entities/payment.entity';
import { PaymentDirection } from '../../payments/entities/payment-direction.enum';
import { PaymentMethod } from '../../payments/entities/payment-method.entity';
import { Customer } from '../../customer-supplier/entities/customer.entity';
import { Supplier } from '../../customer-supplier/entities/supplier.entity';
import { Account } from '../entities/account.entity';
import { AccountType } from '../entities/account-type.enum';
import { JournalSourceType } from '../entities/journal-source-type.enum';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('AccountingPostingService', () => {
  let service: AccountingPostingService;
  let journalEntriesService: jest.Mocked<
    Pick<JournalEntriesService, 'findBySource' | 'createInternal'>
  >;
  let manager: { findOne: jest.Mock };

  const buildPayment = (overrides: Partial<Payment> = {}): Payment =>
    ({
      id: 'payment-1',
      companyId: 'company-a',
      branchId: null,
      direction: PaymentDirection.Receipt,
      customerId: 'cust-1',
      supplierId: null,
      paymentMethodId: 'pm-1',
      amount: '100.00',
      currency: 'USD',
      paymentNumber: 'PMT-2026-000001',
      paymentDate: new Date('2026-01-15T00:00:00Z'),
      ...overrides,
    }) as Payment;

  const buildPaymentMethod = (
    overrides: Partial<PaymentMethod> = {},
  ): PaymentMethod =>
    ({
      id: 'pm-1',
      companyId: 'company-a',
      code: 'CASH',
      glAccountId: 'gl-cash',
      ...overrides,
    }) as PaymentMethod;

  const buildCustomer = (overrides: Partial<Customer> = {}): Customer =>
    ({
      id: 'cust-1',
      companyId: 'company-a',
      customerCode: 'CUST-1',
      receivableAccountId: 'gl-receivable',
      ...overrides,
    }) as Customer;

  const buildSupplier = (overrides: Partial<Supplier> = {}): Supplier =>
    ({
      id: 'sup-1',
      companyId: 'company-a',
      supplierCode: 'SUP-1',
      payableAccountId: 'gl-payable',
      ...overrides,
    }) as Supplier;

  const buildAccount = (overrides: Partial<Account> = {}): Account =>
    ({
      id: 'gl-cash',
      companyId: 'company-a',
      code: 'CASH-GL',
      name: 'Cash',
      accountType: AccountType.Asset,
      isActive: true,
      ...overrides,
    }) as Account;

  beforeEach(() => {
    journalEntriesService = {
      findBySource: jest.fn().mockResolvedValue(null),
      createInternal: jest
        .fn()
        .mockImplementation((params) =>
          Promise.resolve({ id: 'je-1', ...params }),
        ),
    };
    manager = { findOne: jest.fn() };

    service = new AccountingPostingService(
      journalEntriesService as unknown as JournalEntriesService,
    );
  });

  describe('idempotency (D15)', () => {
    it('returns the existing journal entry if one already exists for this (companyId, PAYMENT, paymentId)', async () => {
      const existing = { id: 'existing-je' };
      journalEntriesService.findBySource.mockResolvedValue(existing as never);

      const result = await service.postPayment(
        buildPayment(),
        buildPaymentMethod(),
        buildCustomer(),
        null,
        'user-1',
        manager as unknown as EntityManager,
      );

      expect(result).toBe(existing);
      expect(journalEntriesService.createInternal).not.toHaveBeenCalled();
    });
  });

  describe('RECEIPT posting rules', () => {
    it('posts Dr cash/bank / Cr receivable for a RECEIPT payment', async () => {
      manager.findOne
        .mockResolvedValueOnce(buildAccount({ id: 'gl-cash' })) // cash/bank
        .mockResolvedValueOnce(
          buildAccount({ id: 'gl-receivable', code: 'AR' }),
        ); // receivable

      await service.postPayment(
        buildPayment({ direction: PaymentDirection.Receipt }),
        buildPaymentMethod(),
        buildCustomer(),
        null,
        'user-1',
        manager as unknown as EntityManager,
      );

      expect(journalEntriesService.createInternal).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceType: JournalSourceType.Payment,
          sourceId: 'payment-1',
          lines: [
            expect.objectContaining({
              accountId: 'gl-cash',
              debitAmount: '100.00',
              creditAmount: '0.00',
            }),
            expect.objectContaining({
              accountId: 'gl-receivable',
              debitAmount: '0.00',
              creditAmount: '100.00',
            }),
          ],
        }),
      );
    });
  });

  describe('PAYMENT posting rules', () => {
    it('posts Dr payable / Cr cash/bank for a PAYMENT (supplier) payment', async () => {
      manager.findOne
        .mockResolvedValueOnce(buildAccount({ id: 'gl-cash' })) // cash/bank
        .mockResolvedValueOnce(buildAccount({ id: 'gl-payable', code: 'AP' })); // payable

      await service.postPayment(
        buildPayment({
          direction: PaymentDirection.Payment,
          customerId: null,
          supplierId: 'sup-1',
        }),
        buildPaymentMethod(),
        null,
        buildSupplier(),
        'user-1',
        manager as unknown as EntityManager,
      );

      expect(journalEntriesService.createInternal).toHaveBeenCalledWith(
        expect.objectContaining({
          lines: [
            expect.objectContaining({
              accountId: 'gl-payable',
              debitAmount: '100.00',
              creditAmount: '0.00',
            }),
            expect.objectContaining({
              accountId: 'gl-cash',
              debitAmount: '0.00',
              creditAmount: '100.00',
            }),
          ],
        }),
      );
    });
  });

  describe('fail-closed account-mapping semantics (LOCKED)', () => {
    it('fails when PaymentMethod.glAccountId is null', async () => {
      await expect(
        service.postPayment(
          buildPayment(),
          buildPaymentMethod({ glAccountId: null }),
          buildCustomer(),
          null,
          'user-1',
          manager as unknown as EntityManager,
        ),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
      expect(journalEntriesService.createInternal).not.toHaveBeenCalled();
    });

    it('fails when the PaymentMethod.glAccountId does not resolve to an active account', async () => {
      manager.findOne.mockResolvedValueOnce(null); // cash/bank lookup fails

      await expect(
        service.postPayment(
          buildPayment(),
          buildPaymentMethod(),
          buildCustomer(),
          null,
          'user-1',
          manager as unknown as EntityManager,
        ),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
      expect(journalEntriesService.createInternal).not.toHaveBeenCalled();
    });

    it('fails when Customer.receivableAccountId is null (RECEIPT)', async () => {
      manager.findOne.mockResolvedValueOnce(buildAccount()); // cash/bank resolves fine

      await expect(
        service.postPayment(
          buildPayment(),
          buildPaymentMethod(),
          buildCustomer({ receivableAccountId: null }),
          null,
          'user-1',
          manager as unknown as EntityManager,
        ),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
      expect(journalEntriesService.createInternal).not.toHaveBeenCalled();
    });

    it('fails when Customer.receivableAccountId does not resolve to an active account', async () => {
      manager.findOne
        .mockResolvedValueOnce(buildAccount()) // cash/bank resolves fine
        .mockResolvedValueOnce(null); // receivable lookup fails

      await expect(
        service.postPayment(
          buildPayment(),
          buildPaymentMethod(),
          buildCustomer(),
          null,
          'user-1',
          manager as unknown as EntityManager,
        ),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
      expect(journalEntriesService.createInternal).not.toHaveBeenCalled();
    });

    it('fails when Supplier.payableAccountId is null (PAYMENT)', async () => {
      manager.findOne.mockResolvedValueOnce(buildAccount()); // cash/bank resolves fine

      await expect(
        service.postPayment(
          buildPayment({
            direction: PaymentDirection.Payment,
            customerId: null,
            supplierId: 'sup-1',
          }),
          buildPaymentMethod(),
          null,
          buildSupplier({ payableAccountId: null }),
          'user-1',
          manager as unknown as EntityManager,
        ),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
      expect(journalEntriesService.createInternal).not.toHaveBeenCalled();
    });

    it('fails when RECEIPT has no resolved customer at all', async () => {
      manager.findOne.mockResolvedValueOnce(buildAccount());

      await expect(
        service.postPayment(
          buildPayment(),
          buildPaymentMethod(),
          null,
          null,
          'user-1',
          manager as unknown as EntityManager,
        ),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
      expect(journalEntriesService.createInternal).not.toHaveBeenCalled();
    });
  });

  describe('D15 race backstop', () => {
    it('catches a duplicate-source-index violation and re-fetches the winning row', async () => {
      manager.findOne
        .mockResolvedValueOnce(buildAccount())
        .mockResolvedValueOnce(buildAccount({ id: 'gl-receivable' }));

      const dupError = Object.assign(
        new Error('Duplicate entry for key source'),
        {
          code: 'ER_DUP_ENTRY',
          errno: 1062,
        },
      );
      journalEntriesService.createInternal.mockRejectedValueOnce(dupError);
      const winningRow = { id: 'winning-je' };
      journalEntriesService.findBySource
        .mockResolvedValueOnce(null) // initial idempotency check
        .mockResolvedValueOnce(winningRow as never); // race backstop re-fetch

      const result = await service.postPayment(
        buildPayment(),
        buildPaymentMethod(),
        buildCustomer(),
        null,
        'user-1',
        manager as unknown as EntityManager,
      );

      expect(result).toBe(winningRow);
    });

    it('re-throws an unrelated duplicate-key error rather than swallowing it', async () => {
      manager.findOne
        .mockResolvedValueOnce(buildAccount())
        .mockResolvedValueOnce(buildAccount({ id: 'gl-receivable' }));

      const unrelatedDupError = Object.assign(
        new Error('Duplicate entry for key journal_number'),
        { code: 'ER_DUP_ENTRY', errno: 1062 },
      );
      journalEntriesService.createInternal.mockRejectedValueOnce(
        unrelatedDupError,
      );

      await expect(
        service.postPayment(
          buildPayment(),
          buildPaymentMethod(),
          buildCustomer(),
          null,
          'user-1',
          manager as unknown as EntityManager,
        ),
      ).rejects.toBe(unrelatedDupError);
    });
  });
});
