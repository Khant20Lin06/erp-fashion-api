import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { EntityManager, Repository } from 'typeorm';
import { Payment } from '../entities/payment.entity';
import { PaymentAllocation } from '../entities/payment-allocation.entity';
import { PaymentMethod as PaymentMethodEntity } from '../entities/payment-method.entity';
import { PaymentDirection } from '../entities/payment-direction.enum';
import { PaymentStatus } from '../entities/payment-status.enum';
import { PaymentReferenceType } from '../entities/payment-reference-type.enum';
import { PaymentMethodStatus } from '../entities/payment-method-status.enum';
import { CompanyPaymentCounter } from '../entities/company-payment-counter.entity';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { ListPaymentsDto } from '../dto/list-payments.dto';
import { PaymentMethodsService } from './payment-methods.service';
import { formatDocumentNumber } from '../../inventory/utils/document-number';
import { retryOnDuplicateEntry } from '../../inventory/utils/upsert-retry';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { CompaniesService } from '../../organization/services/companies.service';
import { BranchesService } from '../../organization/services/branches.service';
import { CustomersService } from '../../customer-supplier/services/customers.service';
import { Customer as CustomerEntity } from '../../customer-supplier/entities/customer.entity';
import { CustomerStatus } from '../../customer-supplier/entities/customer-status.enum';
import { SuppliersService } from '../../customer-supplier/services/suppliers.service';
import { Supplier as SupplierEntity } from '../../customer-supplier/entities/supplier.entity';
import { SupplierStatus } from '../../customer-supplier/entities/supplier-status.enum';
import { SalesService } from '../../sales/services/sales.service';
import { PurchaseOrdersService } from '../../purchase/services/purchase-orders.service';
import { AccountingPostingService } from '../../accounting/services/accounting-posting.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { OutboxService } from '../../outbox/services/outbox.service';
import { RequestContextService } from '../../../core/context/request-context.service';
import {
  PAYMENT_AGGREGATE_TYPE,
  PAYMENT_CONFIRMED_EVENT_TYPE,
  PAYMENT_CONFIRMED_EVENT_VERSION,
  PaymentConfirmedEventPayload,
} from '../events/payment-confirmed.event';

export interface PaginatedPayments {
  data: Payment[];
  meta: { page: number; limit: number; total: number };
}

/**
 * The only (referenceType, direction) combinations the locked spec allows
 * (§Transaction flow, step 5): a RECEIPT can only ever allocate against a
 * SALE, a PAYMENT can only ever allocate against a PURCHASE_ORDER. Any
 * other combination is a 400 business-rule violation, checked before the
 * transaction opens.
 */
const VALID_DIRECTION_REFERENCE_PAIRS: Record<
  PaymentDirection,
  PaymentReferenceType
> = {
  [PaymentDirection.Receipt]: PaymentReferenceType.Sale,
  [PaymentDirection.Payment]: PaymentReferenceType.PurchaseOrder,
};

/**
 * Payments domain service (Phase 16, locked decisions D1-D18). D1: Payment
 * is the dedicated, authoritative payment record — Sale/PurchaseOrder are
 * never mutated except through the applyPayment() integration point this
 * service calls (D16). D4: every Payment is created directly CONFIRMED —
 * see docs/PAYMENT_ARCHITECTURE.md "Lifecycle Decision" for the full
 * reasoning on why a separate DRAFT stage was judged unnecessary. D5:
 * confirmed payments are immutable — no update/delete method exists on
 * this service at all, not even a private one.
 */
@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly transactionService: TransactionService,
    private readonly companiesService: CompaniesService,
    private readonly branchesService: BranchesService,
    private readonly customersService: CustomersService,
    private readonly suppliersService: SuppliersService,
    private readonly paymentMethodsService: PaymentMethodsService,
    private readonly salesService: SalesService,
    private readonly purchaseOrdersService: PurchaseOrdersService,
    private readonly accountingPostingService: AccountingPostingService,
    private readonly outboxService: OutboxService,
    private readonly requestContextService: RequestContextService,
  ) {}

  async findAll(
    companyId: string,
    query: ListPaymentsDto,
  ): Promise<PaginatedPayments> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;

    const qb = this.paymentRepository
      .createQueryBuilder('payment')
      .where('payment.companyId = :companyId', { companyId });

    if (query.branchId) {
      qb.andWhere('payment.branchId = :branchId', {
        branchId: query.branchId,
      });
    }
    if (query.direction) {
      qb.andWhere('payment.direction = :direction', {
        direction: query.direction,
      });
    }
    if (query.customerId) {
      qb.andWhere('payment.customerId = :customerId', {
        customerId: query.customerId,
      });
    }
    if (query.supplierId) {
      qb.andWhere('payment.supplierId = :supplierId', {
        supplierId: query.supplierId,
      });
    }
    if (query.paymentMethodId) {
      qb.andWhere('payment.paymentMethodId = :paymentMethodId', {
        paymentMethodId: query.paymentMethodId,
      });
    }
    if (query.status) {
      qb.andWhere('payment.status = :status', { status: query.status });
    }

    qb.orderBy('payment.createdAt', 'DESC')
      .addOrderBy('payment.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { page, limit, total } };
  }

  async findByIdInCompany(id: string, companyId: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id, companyId },
      relations: { allocations: true },
    });
    if (!payment) {
      throw new AppException(ErrorCode.NotFound, 'Payment not found');
    }
    return payment;
  }

  private async findByIdempotencyKey(
    companyId: string,
    idempotencyKey: string,
  ): Promise<Payment | null> {
    return this.paymentRepository.findOne({
      where: { companyId, idempotencyKey },
      relations: { allocations: true },
    });
  }

  /**
   * Locks (SELECT ... FOR UPDATE) and increments the company's per-year
   * payment-number counter inside the caller's transaction — the exact
   * `company_sale_counters`/`company_purchase_counters`/
   * `company_goods_receipt_counters` pattern (Phase 12/13/14) applied here
   * (D6, LOCKED).
   */
  private async generatePaymentNumber(
    companyId: string,
    year: number,
    manager: EntityManager,
  ): Promise<string> {
    await retryOnDuplicateEntry(() =>
      manager.query(
        'INSERT INTO `company_payment_counters` (`id`, `company_id`, `year`, `last_sequence`) ' +
          'VALUES (?, ?, ?, 0) ' +
          'ON DUPLICATE KEY UPDATE `last_sequence` = `last_sequence`',
        [randomUUID(), companyId, year],
      ),
    );

    const counter = await manager
      .createQueryBuilder(CompanyPaymentCounter, 'counter')
      .where('counter.companyId = :companyId', { companyId })
      .andWhere('counter.year = :year', { year })
      .setLock('pessimistic_write')
      .getOneOrFail();

    const nextSequence = counter.lastSequence + 1;
    // manager.update() rather than manager.save() — see
    // GoodsReceiptsService.generateReceiptNumber()'s comment (Phase 14) for
    // why: save() on an entity hydrated via
    // createQueryBuilder().setLock().getOneOrFail() was found, via a real
    // e2e concurrency test, to sometimes issue a duplicate INSERT instead
    // of an UPDATE. update() is unambiguous.
    await manager.update(CompanyPaymentCounter, counter.id, {
      lastSequence: nextSequence,
    });
    return formatDocumentNumber('PMT', year, nextSequence);
  }

  /**
   * Customer/Supplier direction validation (locked spec's Transaction flow,
   * step 3): exactly one of customerId/supplierId must be set, matching
   * direction. Reuses CustomersService/SuppliersService.findByIdInCompany()
   * verbatim — never re-derives cross-company/existence checks.
   */
  private async assertValidPartyForDirection(
    direction: PaymentDirection,
    companyId: string,
    customerId?: string,
    supplierId?: string,
  ): Promise<void> {
    if (direction === PaymentDirection.Receipt) {
      if (!customerId || supplierId) {
        throw new AppException(
          ErrorCode.ValidationError,
          'RECEIPT payments require customerId to be set and supplierId to be omitted',
        );
      }
      const customer = await this.customersService.findByIdInCompany(
        customerId,
        companyId,
      );
      if (customer.status === CustomerStatus.Blocked) {
        throw new AppException(
          ErrorCode.ValidationError,
          'customerId references a blocked customer',
        );
      }
      return;
    }

    // direction === PAYMENT
    if (!supplierId || customerId) {
      throw new AppException(
        ErrorCode.ValidationError,
        'PAYMENT payments require supplierId to be set and customerId to be omitted',
      );
    }
    const supplier = await this.suppliersService.findByIdInCompany(
      supplierId,
      companyId,
    );
    if (supplier.status === SupplierStatus.Blocked) {
      throw new AppException(
        ErrorCode.ValidationError,
        'supplierId references a blocked supplier',
      );
    }
  }

  private async assertValidPaymentMethod(
    paymentMethodId: string,
    companyId: string,
  ): Promise<void> {
    const paymentMethod = await this.paymentMethodsService.findByIdInCompany(
      paymentMethodId,
      companyId,
    );
    if (paymentMethod.status !== PaymentMethodStatus.Active) {
      throw new AppException(
        ErrorCode.ValidationError,
        'paymentMethodId must reference an active payment method',
      );
    }
  }

  /**
   * Validates every allocation's referenceType matches the payment's
   * direction (locked spec's Transaction flow, step 5: RECEIPT+SALE valid,
   * PAYMENT+PURCHASE_ORDER valid, the other two combinations rejected).
   * Also validates the allocation amounts sum to at most the payment's own
   * amount (step 11) and that every individual allocation amount is > 0.
   */
  private assertAllocationsValid(
    direction: PaymentDirection,
    paymentAmount: number,
    allocations: CreatePaymentDto['allocations'],
  ): void {
    const expectedReferenceType = VALID_DIRECTION_REFERENCE_PAIRS[direction];
    let allocatedTotal = 0;

    for (const allocation of allocations) {
      if (allocation.referenceType !== expectedReferenceType) {
        throw new AppException(
          ErrorCode.ValidationError,
          `A ${direction} payment can only allocate against ${expectedReferenceType} references, got ${allocation.referenceType}`,
        );
      }
      const amount = Number(allocation.allocatedAmount);
      if (!(amount > 0)) {
        throw new AppException(
          ErrorCode.ValidationError,
          'allocatedAmount must be greater than zero',
        );
      }
      allocatedTotal += amount;
    }

    if (allocatedTotal > paymentAmount + 1e-9) {
      throw new AppException(
        ErrorCode.ValidationError,
        `Sum of allocations (${allocatedTotal.toFixed(2)}) cannot exceed the payment amount (${paymentAmount.toFixed(2)})`,
      );
    }
  }

  /**
   * Creates a Payment together with all of its PaymentAllocations, and
   * applies each allocation's amount to its target Sale/PurchaseOrder's
   * paidAmount/balanceAmount, inside a single TransactionService.run()
   * call (locked spec's Transaction flow, steps 7-15). Any failure at any
   * step rolls back everything — no partial Payment, no partial
   * PaymentAllocation, no partial Sale/PurchaseOrder balance change.
   *
   * Idempotency (D11): when dto carries an idempotencyKey, an existing
   * Payment with that (companyId, idempotencyKey) pair is looked up BEFORE
   * the transaction opens; if found, it is returned as-is (the controller
   * maps this to 200, not 201) instead of creating a duplicate. The race
   * where two concurrent requests carry the same brand-new key is handled
   * by catching the unique-constraint violation the second transaction's
   * INSERT will raise and re-fetching the winning row — the unique index
   * itself is the concurrency backstop, not an application-level lock on a
   * not-yet-existing row (which cannot be locked).
   */
  async create(
    companyId: string,
    userId: string,
    dto: CreatePaymentDto,
    idempotencyKeyHeader?: string,
  ): Promise<{ payment: Payment; wasExisting: boolean }> {
    const idempotencyKey = idempotencyKeyHeader?.trim() || undefined;

    if (idempotencyKey) {
      const existing = await this.findByIdempotencyKey(
        companyId,
        idempotencyKey,
      );
      if (existing) {
        return { payment: existing, wasExisting: true };
      }
    }

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

    await this.assertValidPartyForDirection(
      dto.direction,
      companyId,
      dto.customerId,
      dto.supplierId,
    );
    await this.assertValidPaymentMethod(dto.paymentMethodId, companyId);

    const amount = Number(dto.amount);
    this.assertAllocationsValid(dto.direction, amount, dto.allocations);

    const paymentDate = dto.paymentDate
      ? new Date(dto.paymentDate)
      : new Date();
    const year = paymentDate.getUTCFullYear();

    const runCreate = async (): Promise<Payment> =>
      this.transactionService.run(async (manager) => {
        const paymentNumber = await this.generatePaymentNumber(
          companyId,
          year,
          manager,
        );

        // Deterministic lock order across every distinct target document
        // referenced by this payment's allocations — sorted by
        // (referenceType, referenceId) BEFORE acquiring any lock, the same
        // deadlock-prevention step StockTransfersService established for
        // cross-warehouse locking (Phase 14 D9), applied here across
        // potentially many Sale/PurchaseOrder rows referenced by a single
        // payment's allocations (locked spec's Transaction flow, step 9).
        const dedupedTargets = new Map<
          string,
          { referenceType: PaymentReferenceType; referenceId: string }
        >();
        for (const allocation of dto.allocations) {
          const key = `${allocation.referenceType}:${allocation.referenceId}`;
          if (!dedupedTargets.has(key)) {
            dedupedTargets.set(key, {
              referenceType: allocation.referenceType,
              referenceId: allocation.referenceId,
            });
          }
        }
        const sortedTargets = [...dedupedTargets.values()].sort((a, b) => {
          const typeCompare = a.referenceType.localeCompare(b.referenceType);
          if (typeCompare !== 0) return typeCompare;
          return a.referenceId.localeCompare(b.referenceId);
        });

        // Lock every target document row up front, in the deterministic
        // order above, before validating/mutating any of them —
        // all-or-nothing (locked spec's Transaction flow, step 10).
        // applyPayment() itself performs the actual lock (SELECT ... FOR
        // UPDATE) via manager — calling it here for every target BEFORE
        // any Payment/PaymentAllocation row is created also means an
        // over-allocation failure on the Nth target rolls back cleanly.
        const allocationTotalsByTarget = new Map<string, number>();
        for (const allocation of dto.allocations) {
          const key = `${allocation.referenceType}:${allocation.referenceId}`;
          const current = allocationTotalsByTarget.get(key) ?? 0;
          allocationTotalsByTarget.set(
            key,
            current + Number(allocation.allocatedAmount),
          );
        }

        for (const target of sortedTargets) {
          const key = `${target.referenceType}:${target.referenceId}`;
          const totalForTarget = allocationTotalsByTarget.get(key)!;

          if (target.referenceType === PaymentReferenceType.Sale) {
            await this.salesService.applyPayment(
              target.referenceId,
              companyId,
              totalForTarget,
              userId,
              manager,
            );
          } else {
            await this.purchaseOrdersService.applyPayment(
              target.referenceId,
              companyId,
              totalForTarget,
              userId,
              manager,
            );
          }
        }

        const payment = manager.create(Payment, {
          paymentNumber,
          companyId,
          branchId: dto.branchId ?? null,
          direction: dto.direction,
          customerId: dto.customerId ?? null,
          supplierId: dto.supplierId ?? null,
          paymentMethodId: dto.paymentMethodId,
          amount: amount.toFixed(2),
          currency: dto.currency,
          reference: dto.reference ?? null,
          idempotencyKey: idempotencyKey ?? null,
          status: PaymentStatus.Confirmed,
          paymentDate,
          notes: dto.notes ?? null,
          createdBy: userId,
          updatedBy: userId,
        });
        const savedPayment = await manager.save(Payment, payment);

        for (const allocation of dto.allocations) {
          const allocationRow = manager.create(PaymentAllocation, {
            paymentId: savedPayment.id,
            referenceType: allocation.referenceType,
            referenceId: allocation.referenceId,
            allocatedAmount: Number(allocation.allocatedAmount).toFixed(2),
          });
          await manager.save(PaymentAllocation, allocationRow);
        }

        savedPayment.allocations = await manager.find(PaymentAllocation, {
          where: { paymentId: savedPayment.id },
        });

        // Phase 17 addition (D6/D7/D13/D19, LOCKED, EXPLICITLY AUTHORIZED
        // cross-phase call — the ONE change to this method beyond Phase
        // 16's original logic): synchronously post this Payment to the
        // General Ledger inside the SAME transaction, after the Payment
        // and PaymentAllocation rows exist so sourceId=savedPayment.id is
        // a real row. Reads PaymentMethod/Customer/Supplier via the
        // transactional manager (never the injected repositories) so the
        // read is consistent with this transaction's own writes.
        // AccountingPostingService.postPayment() fails closed
        // (ValidationError) if the required Account mapping is missing on
        // PaymentMethod.glAccountId / Customer.receivableAccountId /
        // Supplier.payableAccountId — that failure propagates out of this
        // transaction callback and rolls back everything above: no
        // Payment row, no PaymentAllocation row, no Sale/PurchaseOrder
        // balance change, no JournalEntry (D7).
        const paymentMethodForPosting = await manager.findOneOrFail(
          PaymentMethodEntity,
          { where: { id: dto.paymentMethodId } },
        );
        const customerForPosting = savedPayment.customerId
          ? await manager.findOne(CustomerEntity, {
              where: { id: savedPayment.customerId },
            })
          : null;
        const supplierForPosting = savedPayment.supplierId
          ? await manager.findOne(SupplierEntity, {
              where: { id: savedPayment.supplierId },
            })
          : null;

        await this.accountingPostingService.postPayment(
          savedPayment,
          paymentMethodForPosting,
          customerForPosting,
          supplierForPosting,
          userId,
          manager,
        );

        // Phase 18 addition (D1-D10, LOCKED, the one authorized cross-phase
        // call this phase adds to this method): writes a `payment.confirmed`
        // OutboxEvent row inside this SAME transaction/manager, immediately
        // after postPayment() and still before this method returns — so the
        // outbox row commits atomically with the Payment/PaymentAllocation/
        // JournalEntry rows above (all-or-nothing) and rolls back with them
        // on any failure. This is purely additive: it does not read back
        // anything already computed above other than local variables already
        // in scope (savedPayment, savedPayment.allocations), and it makes no
        // change to idempotency handling, lock ordering, or double-entry
        // posting. OutboxService.create() never opens its own transaction
        // (see its own docblock) — it only ever writes through `manager`.
        // Kafka itself is never touched here; publishing happens later, out
        // of band, via OutboxPublisherService (D2/D3).
        const paymentConfirmedPayload: PaymentConfirmedEventPayload = {
          paymentId: savedPayment.id,
          paymentNumber: savedPayment.paymentNumber,
          direction: savedPayment.direction,
          amount: savedPayment.amount,
          currency: savedPayment.currency,
          paymentMethodId: savedPayment.paymentMethodId,
          customerId: savedPayment.customerId,
          supplierId: savedPayment.supplierId,
          paymentDate: savedPayment.paymentDate.toISOString(),
          allocationIds: (savedPayment.allocations ?? []).map(
            (allocation) => allocation.id,
          ),
        };
        await this.outboxService.create(manager, {
          eventType: PAYMENT_CONFIRMED_EVENT_TYPE,
          eventVersion: PAYMENT_CONFIRMED_EVENT_VERSION,
          aggregateType: PAYMENT_AGGREGATE_TYPE,
          aggregateId: savedPayment.id,
          companyId: savedPayment.companyId,
          branchId: savedPayment.branchId,
          correlationId: this.requestContextService.getRequestId() ?? null,
          causationId: null,
          payload: paymentConfirmedPayload,
        });

        return savedPayment;
      });

    try {
      const payment = await runCreate();
      return { payment, wasExisting: false };
    } catch (error) {
      // Idempotency race backstop (D11, locked spec): two truly concurrent
      // requests carrying the same brand-new idempotencyKey can both pass
      // the pre-transaction lookup above (neither sees the other's
      // not-yet-committed row) and both attempt the INSERT — the
      // UNIQUE(company_id, idempotency_key) constraint lets exactly one
      // commit and makes the other raise ER_DUP_ENTRY. Catch that specific
      // error and re-fetch the winning row instead of surfacing a 500 or a
      // spurious duplicate.
      if (idempotencyKey && this.isDuplicateIdempotencyKeyError(error)) {
        const existing = await this.findByIdempotencyKey(
          companyId,
          idempotencyKey,
        );
        if (existing) {
          return { payment: existing, wasExisting: true };
        }
      }
      throw error;
    }
  }

  private isDuplicateIdempotencyKeyError(error: unknown): boolean {
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
    // Narrow to the idempotency-key index specifically so an unrelated
    // duplicate-key failure (e.g. a payment-number collision, which should
    // never happen given the counter lock, but defensively) is not
    // silently swallowed as if it were an idempotency replay.
    return (err?.message ?? '').includes('idempotency');
  }
}
