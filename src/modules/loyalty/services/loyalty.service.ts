import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { LoyaltyPointTransaction } from '../entities/loyalty-point-transaction.entity';
import { LoyaltyPointTransactionType } from '../entities/loyalty-point-transaction-type.enum';
import { LoyaltyProgramService } from './loyalty-program.service';
import { CustomersService } from '../../customer-supplier/services/customers.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import { TransactionService } from '../../../core/transaction/transaction.service';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { RedeemLoyaltyPointsDto } from '../dto/loyalty-transactions.dto';

@Injectable()
export class LoyaltyService {
  constructor(
    @InjectRepository(LoyaltyPointTransaction)
    private readonly transactionRepository: Repository<LoyaltyPointTransaction>,
    private readonly loyaltyProgramService: LoyaltyProgramService,
    private readonly customersService: CustomersService,
    private readonly transactionService: TransactionService,
  ) {}

  /** Public entry point for the redeem endpoint — opens its own transaction and delegates to redeem(). */
  async redeemStandalone(
    companyId: string,
    customerId: string,
    userId: string,
    dto: RedeemLoyaltyPointsDto,
  ): Promise<LoyaltyPointTransaction> {
    return this.transactionService.run((manager) =>
      this.redeem(manager, companyId, customerId, userId, dto),
    );
  }

  async findTransactionsForCustomer(
    companyId: string,
    customerId: string,
    page = DEFAULT_PAGE,
    limit = DEFAULT_LIMIT,
  ): Promise<{
    data: LoyaltyPointTransaction[];
    meta: { page: number; limit: number; total: number };
  }> {
    const [data, total] = await this.transactionRepository.findAndCount({
      where: { companyId, customerId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, meta: { page, limit, total } };
  }

  /**
   * Available balance is ALWAYS derived as SUM(pointsDelta) across every
   * ledger row for the customer — never a mutable counter (LOCKED). Reads
   * through the caller's manager when given (so a redeem's balance check
   * sees its own transaction's uncommitted locks/writes consistently),
   * otherwise the injected repository for a plain read-only query.
   */
  async getAvailableBalance(
    companyId: string,
    customerId: string,
    manager?: EntityManager,
  ): Promise<number> {
    const repo = manager
      ? manager.getRepository(LoyaltyPointTransaction)
      : this.transactionRepository;
    const result = await repo
      .createQueryBuilder('tx')
      .select('COALESCE(SUM(tx.pointsDelta), 0)', 'balance')
      .where('tx.companyId = :companyId', { companyId })
      .andWhere('tx.customerId = :customerId', { customerId })
      .getRawOne<{ balance: string }>();
    return Number(result?.balance ?? 0);
  }

  /**
   * Earns points for a just-confirmed Sale, inside the CALLER's
   * transaction/manager (never opens its own — mirrors
   * AccountingPostingService.postPayment()'s contract exactly). Idempotent:
   * UNIQUE(company_id, source_type, source_id) on LoyaltyPointTransaction
   * means a retry/replay for the same Sale either finds the existing EARN
   * row first (fast path) or hits the DB constraint and the caller's own
   * duplicate-key handling re-fetches it — mirrors
   * AccountingPostingService.postPayment()'s own findBySource-then-create
   * pattern exactly.
   *
   * Returns null (no points earned, no row created) if: no active
   * LoyaltyProgram is configured for the company, or grandTotal is below
   * minimumPurchaseForEarning, or the computed points would be zero.
   */
  async earnForSale(
    manager: EntityManager,
    companyId: string,
    customerId: string,
    saleId: string,
    saleGrandTotal: string,
    userId: string,
  ): Promise<LoyaltyPointTransaction | null> {
    const existing = await manager.findOne(LoyaltyPointTransaction, {
      where: { companyId, sourceType: 'SALE', sourceId: saleId },
    });
    if (existing) {
      return existing;
    }

    const program = await this.loyaltyProgramService.getActiveProgramOrNull(
      manager,
      companyId,
    );
    if (!program) {
      return null;
    }

    const grandTotal = Number(saleGrandTotal);
    if (grandTotal < Number(program.minimumPurchaseForEarning)) {
      return null;
    }

    const points = Math.floor(
      grandTotal * Number(program.pointsPerCurrencyUnit),
    );
    if (points <= 0) {
      return null;
    }

    const entity = manager.create(LoyaltyPointTransaction, {
      companyId,
      customerId,
      type: LoyaltyPointTransactionType.Earn,
      pointsDelta: points,
      redemptionValue: null,
      sourceType: 'SALE',
      sourceId: saleId,
      reversesTransactionId: null,
      notes: null,
      createdBy: userId,
    });

    try {
      return await manager.save(LoyaltyPointTransaction, entity);
    } catch (error) {
      if (this.isDuplicateSourceError(error)) {
        const winning = await manager.findOne(LoyaltyPointTransaction, {
          where: { companyId, sourceType: 'SALE', sourceId: saleId },
        });
        if (winning) {
          return winning;
        }
      }
      throw error;
    }
  }

  /**
   * Reverses previously-earned points for a confirmed SaleReturn,
   * proportional to the returned quantity's share of the original Sale
   * (LOCKED business rule — see SaleReturnsService.confirm()'s exact call
   * site for how the proportion is computed from real returned line
   * amounts, never an arbitrary guess). Idempotent via
   * UNIQUE(company_id, source_type, source_id) on
   * (sourceType='SALE_RETURN', sourceId=saleReturn.id) exactly like
   * earnForSale(). No-ops (returns null) if the original Sale never earned
   * points (no EARN transaction exists for it) — nothing to reverse.
   *
   * If reversing would drive the balance negative (customer already
   * redeemed the points being clawed back), this method does NOT fabricate
   * behavior — it still records the REVERSAL row (the ledger must reflect
   * the real event) but the resulting negative balance is a real,
   * documented business-rule limitation (see docs / final report §14):
   * this codebase has no debt/negative-balance UI or dunning process, so a
   * negative balance simply blocks further redemption until it is earned
   * back, exactly like Payment/Sale never allow a negative grandTotal.
   */
  async reverseForSaleReturn(
    manager: EntityManager,
    companyId: string,
    customerId: string,
    saleId: string,
    saleReturnId: string,
    reversalPoints: number,
    userId: string,
  ): Promise<LoyaltyPointTransaction | null> {
    if (reversalPoints <= 0) {
      return null;
    }

    const existingReversal = await manager.findOne(LoyaltyPointTransaction, {
      where: { companyId, sourceType: 'SALE_RETURN', sourceId: saleReturnId },
    });
    if (existingReversal) {
      return existingReversal;
    }

    const originalEarn = await manager.findOne(LoyaltyPointTransaction, {
      where: { companyId, sourceType: 'SALE', sourceId: saleId },
    });
    if (!originalEarn) {
      return null;
    }

    const entity = manager.create(LoyaltyPointTransaction, {
      companyId,
      customerId,
      type: LoyaltyPointTransactionType.Reversal,
      pointsDelta: -reversalPoints,
      redemptionValue: null,
      sourceType: 'SALE_RETURN',
      sourceId: saleReturnId,
      reversesTransactionId: originalEarn.id,
      notes: null,
      createdBy: userId,
    });

    try {
      return await manager.save(LoyaltyPointTransaction, entity);
    } catch (error) {
      if (this.isDuplicateSourceError(error)) {
        const winning = await manager.findOne(LoyaltyPointTransaction, {
          where: {
            companyId,
            sourceType: 'SALE_RETURN',
            sourceId: saleReturnId,
          },
        });
        if (winning) {
          return winning;
        }
      }
      throw error;
    }
  }

  /**
   * Redeems points for a customer. Concurrency-safe: locks every existing
   * ledger row for this customer (pessimistic_write) before computing the
   * balance, so two concurrent redeem requests serialize on the same lock
   * rather than both reading a stale balance and both succeeding
   * (over-spend). If there are zero prior rows, nothing to lock and the
   * balance is definitionally zero — the redemption is rejected by the
   * insufficient-balance check below without needing a lock (no row exists
   * yet for a concurrent request to race against).
   */
  async redeem(
    manager: EntityManager,
    companyId: string,
    customerId: string,
    userId: string,
    dto: RedeemLoyaltyPointsDto,
  ): Promise<LoyaltyPointTransaction> {
    await this.customersService.findByIdInCompany(customerId, companyId);

    const program = await this.loyaltyProgramService.getActiveProgramOrNull(
      manager,
      companyId,
    );
    if (!program) {
      throw new AppException(
        ErrorCode.UnprocessableEntity,
        'No active loyalty program is configured for this company',
      );
    }

    // Lock every existing row for this customer — the concurrency backstop.
    // A second concurrent redeem call blocks here until the first commits,
    // then re-reads the now-up-to-date SUM, matching
    // PayrollRunsService.calculate()'s own "lock, then read consistently"
    // discipline.
    await manager
      .createQueryBuilder(LoyaltyPointTransaction, 'tx')
      .where('tx.companyId = :companyId', { companyId })
      .andWhere('tx.customerId = :customerId', { customerId })
      .setLock('pessimistic_write')
      .getMany();

    const balance = await this.getAvailableBalance(
      companyId,
      customerId,
      manager,
    );
    if (dto.points > balance) {
      throw new AppException(
        ErrorCode.UnprocessableEntity,
        `Insufficient loyalty points: requested ${dto.points}, available ${balance}`,
      );
    }

    const redemptionValue = (
      dto.points * Number(program.redemptionValuePerPoint)
    ).toFixed(2);

    const entity = manager.create(LoyaltyPointTransaction, {
      companyId,
      customerId,
      type: LoyaltyPointTransactionType.Redeem,
      pointsDelta: -dto.points,
      redemptionValue,
      sourceType: null,
      sourceId: null,
      reversesTransactionId: null,
      notes: dto.notes ?? null,
      createdBy: userId,
    });
    return manager.save(LoyaltyPointTransaction, entity);
  }

  private isDuplicateSourceError(error: unknown): boolean {
    const err = error as {
      code?: string;
      errno?: number;
      driverError?: { code?: string; errno?: number };
    };
    const code = err?.code ?? err?.driverError?.code;
    const errno = err?.errno ?? err?.driverError?.errno;
    return code === 'ER_DUP_ENTRY' || errno === 1062;
  }
}
