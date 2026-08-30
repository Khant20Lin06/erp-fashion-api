import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, FindOptionsWhere, Repository } from 'typeorm';
import { SaleReturn } from '../entities/sale-return.entity';
import { SaleReturnItem } from '../entities/sale-return-item.entity';
import { SaleReturnStatus } from '../entities/sale-return-status.enum';
import { SaleReturnItemCondition } from '../entities/sale-return-item-condition.enum';
import { CompanySaleReturnCounter } from '../entities/company-sale-return-counter.entity';
import { Sale } from '../../sales/entities/sale.entity';
import { SaleItem } from '../../sales/entities/sale-item.entity';
import { SaleStatus } from '../../sales/entities/sale-status.enum';
import { WarehouseStock } from '../../inventory/entities/warehouse-stock.entity';
import { StockMovement } from '../../inventory/entities/stock-movement.entity';
import { StockMovementType } from '../../inventory/entities/stock-movement-type.enum';
import { StockMovementReferenceType } from '../../inventory/entities/stock-movement-reference-type.enum';
import { lockWarehouseStockRow } from '../../inventory/utils/stock-lock';
import { retryOnDuplicateEntry } from '../../inventory/utils/upsert-retry';
import { formatDocumentNumber } from '../../inventory/utils/document-number';
import { LoyaltyService } from '../../loyalty/services/loyalty.service';
import { LoyaltyPointTransaction } from '../../loyalty/entities/loyalty-point-transaction.entity';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import { Warehouse } from '../../organization/entities/warehouse.entity';
import { WarehouseStatus } from '../../organization/entities/warehouse-status.enum';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import {
  CreateSaleReturnDto,
  ListSaleReturnsDto,
} from '../dto/sale-returns.dto';

@Injectable()
export class SaleReturnsService {
  constructor(
    @InjectRepository(SaleReturn)
    private readonly saleReturnRepository: Repository<SaleReturn>,
    @InjectRepository(SaleReturnItem)
    private readonly saleReturnItemRepository: Repository<SaleReturnItem>,
    private readonly loyaltyService: LoyaltyService,
    private readonly transactionService: TransactionService,
  ) {}

  async findAll(
    companyId: string,
    query: ListSaleReturnsDto,
  ): Promise<{
    data: SaleReturn[];
    meta: { page: number; limit: number; total: number };
  }> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;

    const where: FindOptionsWhere<SaleReturn> = {
      companyId,
      ...(query.saleId ? { saleId: query.saleId } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [data, total] = await this.saleReturnRepository.findAndCount({
      where,
      relations: {
        items: true,
        sale: true,
        customer: true,
      },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, meta: { page, limit, total } };
  }

  async findByIdInCompany(id: string, companyId: string): Promise<SaleReturn> {
    const entity = await this.saleReturnRepository.findOne({
      where: { id, companyId },
      relations: { items: true, sale: true, customer: true },
    });
    if (!entity) {
      throw new AppException(ErrorCode.NotFound, 'Sale return not found');
    }
    return entity;
  }

  private loadReturnWithRelations(
    manager: EntityManager,
    id: string,
    companyId: string,
  ): Promise<SaleReturn | null> {
    return manager.findOne(SaleReturn, {
      where: { id, companyId },
      relations: { items: true, sale: true, customer: true },
    });
  }

  private async hydrateReturnOrFallback(
    manager: EntityManager,
    id: string,
    companyId: string,
    fallback: SaleReturn,
  ): Promise<SaleReturn> {
    return (
      (await this.loadReturnWithRelations(manager, id, companyId)) ?? fallback
    );
  }

  /**
   * Legacy-sale recovery path: older CONFIRMED sales may lack warehouseId
   * even though return confirmation now needs a concrete warehouse to restock
   * into. To avoid inventing ambiguous stock history, inference is allowed
   * only when the sale has a branchId and that branch currently has exactly
   * one ACTIVE warehouse in the same company. In that safe case we persist
   * the inferred warehouseId back onto the Sale so future confirmations no
   * longer depend on this fallback.
   */
  private async resolveWarehouseIdForReturnConfirmation(
    manager: EntityManager,
    sale: Sale,
    companyId: string,
  ): Promise<string> {
    if (sale.warehouseId) {
      return sale.warehouseId;
    }

    if (!sale.branchId) {
      throw new AppException(
        ErrorCode.ValidationError,
        'Sale.warehouseId is missing and the legacy sale has no branchId, so the return cannot be confirmed automatically',
      );
    }

    const activeWarehouses = await manager.find(Warehouse, {
      where: {
        companyId,
        branchId: sale.branchId,
        status: WarehouseStatus.Active,
      },
    });

    if (activeWarehouses.length !== 1) {
      throw new AppException(
        ErrorCode.ValidationError,
        activeWarehouses.length === 0
          ? 'Sale.warehouseId is missing and this branch has no active warehouse to restock into'
          : 'Sale.warehouseId is missing and this branch has multiple active warehouses; assign the original sale warehouse before confirming the return',
      );
    }

    const inferredWarehouseId = activeWarehouses[0].id;
    await manager.update(Sale, sale.id, { warehouseId: inferredWarehouseId });
    sale.warehouseId = inferredWarehouseId;
    return inferredWarehouseId;
  }

  /**
   * Resolves how much of a given SaleItem's quantity remains returnable:
   * originalQuantity - SUM(quantity across every non-CANCELLED SaleReturnItem
   * referencing it). Reads through the caller's manager so it sees the
   * caller's own not-yet-committed locks consistently (used both at create
   * time and, implicitly, protected by the SaleItem-row lock acquired
   * below).
   */
  private async getRemainingReturnableQuantity(
    manager: EntityManager,
    saleItemId: string,
    originalQuantity: number,
  ): Promise<number> {
    const result = await manager
      .createQueryBuilder(SaleReturnItem, 'item')
      .innerJoin(SaleReturn, 'saleReturn', 'saleReturn.id = item.saleReturnId')
      .select('COALESCE(SUM(item.quantity), 0)', 'returned')
      .where('item.saleItemId = :saleItemId', { saleItemId })
      .andWhere('saleReturn.status != :cancelled', {
        cancelled: SaleReturnStatus.Cancelled,
      })
      .getRawOne<{ returned: string }>();

    const alreadyReturned = Number(result?.returned ?? 0);
    return originalQuantity - alreadyReturned;
  }

  /**
   * Creates a DRAFT SaleReturn. Validates: the Sale belongs to the resolved
   * company, is CONFIRMED (a DRAFT/CANCELLED sale was never fulfilled —
   * nothing to return), every saleItemId belongs to this Sale, and every
   * requested quantity does not exceed
   * `originalQuantity - previouslyReturnedQuantity`. Over-returning and
   * concurrent double-return are prevented by locking each referenced
   * SaleItem row (pessimistic_write) BEFORE computing the remaining
   * returnable quantity — a second concurrent create() for the same
   * SaleItem blocks until the first commits, then sees the first return's
   * effect, exactly mirroring SalesService.confirm()'s stock-locking
   * discipline.
   */
  async create(
    companyId: string,
    userId: string,
    dto: CreateSaleReturnDto,
  ): Promise<SaleReturn> {
    return this.transactionService.run(async (manager) => {
      const sale = await manager.findOne(Sale, {
        where: { id: dto.saleId, companyId },
      });
      if (!sale) {
        throw new AppException(
          ErrorCode.ValidationError,
          'saleId does not reference a sale in the specified company',
        );
      }
      if (sale.status !== SaleStatus.Confirmed) {
        throw new AppException(
          ErrorCode.UnprocessableEntity,
          `Cannot return items from a sale in status ${sale.status}; only CONFIRMED sales are returnable`,
        );
      }

      // Deterministic lock order (sort by saleItemId) to avoid deadlocks
      // against a concurrent return targeting an overlapping-but-different
      // item set, mirroring SalesService.confirm()'s own sorted-lock
      // pattern.
      const sortedItemDtos = [...dto.items].sort((a, b) =>
        a.saleItemId.localeCompare(b.saleItemId),
      );

      let subtotal = 0;
      let discountTotal = 0;
      const itemsToCreate: Array<{
        saleItem: SaleItem;
        quantity: number;
        discountAmount: number;
        lineTotal: number;
        condition: SaleReturnItemCondition;
      }> = [];

      for (const itemDto of sortedItemDtos) {
        const saleItem = await manager
          .createQueryBuilder(SaleItem, 'saleItem')
          .where('saleItem.id = :id', { id: itemDto.saleItemId })
          .andWhere('saleItem.saleId = :saleId', { saleId: sale.id })
          .setLock('pessimistic_write')
          .getOne();

        if (!saleItem) {
          throw new AppException(
            ErrorCode.ValidationError,
            `saleItemId ${itemDto.saleItemId} does not belong to sale ${sale.id}`,
          );
        }

        const remaining = await this.getRemainingReturnableQuantity(
          manager,
          saleItem.id,
          saleItem.quantity,
        );
        if (itemDto.quantity > remaining) {
          throw new AppException(
            ErrorCode.Conflict,
            `Cannot return ${itemDto.quantity} of sale item ${saleItem.id}: only ${remaining} remain returnable`,
          );
        }

        const discountAmount = Number(itemDto.discountAmount ?? '0');
        const unitPrice = Number(saleItem.unitPriceSnapshot);
        const lineSubtotal = unitPrice * itemDto.quantity;
        if (discountAmount > lineSubtotal) {
          throw new AppException(
            ErrorCode.ValidationError,
            `discountAmount cannot exceed the line subtotal for sale item ${saleItem.id}`,
          );
        }
        const lineTotal = lineSubtotal - discountAmount;

        subtotal += lineSubtotal;
        discountTotal += discountAmount;

        itemsToCreate.push({
          saleItem,
          quantity: itemDto.quantity,
          discountAmount,
          lineTotal,
          condition: itemDto.condition ?? SaleReturnItemCondition.Restock,
        });
      }

      const refundAmount = subtotal - discountTotal;
      const year = new Date().getUTCFullYear();
      const returnNumber = await this.generateReturnNumber(
        companyId,
        year,
        manager,
      );

      const saleReturn = manager.create(SaleReturn, {
        returnNumber,
        companyId,
        branchId: sale.branchId,
        saleId: sale.id,
        customerId: sale.customerId,
        status: SaleReturnStatus.Draft,
        reason: dto.reason ?? null,
        notes: dto.notes ?? null,
        subtotal: subtotal.toFixed(2),
        discountAmount: discountTotal.toFixed(2),
        refundAmount: refundAmount.toFixed(2),
        refundedAmount: '0.00',
        currency: sale.currency,
        createdBy: userId,
        confirmedBy: null,
        confirmedAt: null,
      });
      const savedReturn = await manager.save(SaleReturn, saleReturn);

      for (const item of itemsToCreate) {
        const itemRow = manager.create(SaleReturnItem, {
          saleReturnId: savedReturn.id,
          saleItemId: item.saleItem.id,
          productVariantId: item.saleItem.productVariantId,
          quantity: item.quantity,
          unitPriceSnapshot: item.saleItem.unitPriceSnapshot,
          discountAmount: item.discountAmount.toFixed(2),
          lineTotal: item.lineTotal.toFixed(2),
          condition: item.condition,
          productNameSnapshot: item.saleItem.productNameSnapshot,
          skuSnapshot: item.saleItem.skuSnapshot,
        });
        await manager.save(SaleReturnItem, itemRow);
      }

      savedReturn.items = await manager.find(SaleReturnItem, {
        where: { saleReturnId: savedReturn.id },
      });
      return await this.hydrateReturnOrFallback(
        manager,
        savedReturn.id,
        companyId,
        savedReturn,
      );
    });
  }

  /**
   * DRAFT -> CONFIRMED. Restocks inventory for every RESTOCK-condition item
   * (increments WarehouseStock.onHandQuantity + writes a traceable
   * SaleReturn-referenced StockMovement) and writes a zero-quantity-change
   * StockMovement for every DAMAGED-condition item (documents the return
   * happened without pretending the stock became sellable again — no
   * separate damaged-quantity bucket exists in this codebase's schema, so
   * this is the honest limit of what can be represented). Also reverses
   * loyalty points proportional to this return's refundAmount share of the
   * original Sale's grandTotal, if the sale ever earned points. All inside
   * one locked transaction — a failure anywhere rolls back the entire
   * confirmation, leaving the return in DRAFT.
   */
  async confirm(
    id: string,
    companyId: string,
    userId: string,
  ): Promise<SaleReturn> {
    return this.transactionService.run(async (manager) => {
      const saleReturn = await manager
        .createQueryBuilder(SaleReturn, 'saleReturn')
        .where('saleReturn.id = :id', { id })
        .andWhere('saleReturn.companyId = :companyId', { companyId })
        .setLock('pessimistic_write')
        .getOne();

      if (!saleReturn) {
        throw new AppException(ErrorCode.NotFound, 'Sale return not found');
      }
      if (saleReturn.status !== SaleReturnStatus.Draft) {
        throw new AppException(
          ErrorCode.UnprocessableEntity,
          `Cannot confirm a sale return in status ${saleReturn.status}`,
        );
      }

      const sale = await manager.findOneOrFail(Sale, {
        where: { id: saleReturn.saleId },
      });
      const warehouseId = await this.resolveWarehouseIdForReturnConfirmation(
        manager,
        sale,
        companyId,
      );

      const items = await manager.find(SaleReturnItem, {
        where: { saleReturnId: saleReturn.id },
      });
      const sortedItems = [...items].sort((a, b) =>
        a.productVariantId.localeCompare(b.productVariantId),
      );

      for (const item of sortedItems) {
        if (item.condition === SaleReturnItemCondition.Restock) {
          const stock = await lockWarehouseStockRow(
            manager,
            warehouseId,
            item.productVariantId,
          );
          stock.onHandQuantity += item.quantity;
          await manager.update(WarehouseStock, stock.id, {
            onHandQuantity: stock.onHandQuantity,
          });

          const movement = manager.create(StockMovement, {
            warehouseId,
            productVariantId: item.productVariantId,
            movementType: StockMovementType.SaleReturn,
            quantityChange: item.quantity,
            quantityAfter: stock.onHandQuantity,
            referenceType: StockMovementReferenceType.SaleReturn,
            referenceId: saleReturn.id,
            createdBy: userId,
          });
          await manager.save(StockMovement, movement);
        } else {
          // DAMAGED: no stock quantity change, but still a real, traceable
          // movement row documenting the return happened — never silently
          // dropped.
          const stock = await lockWarehouseStockRow(
            manager,
            warehouseId,
            item.productVariantId,
          );
          const movement = manager.create(StockMovement, {
            warehouseId,
            productVariantId: item.productVariantId,
            movementType: StockMovementType.SaleReturn,
            quantityChange: 0,
            quantityAfter: stock.onHandQuantity,
            referenceType: StockMovementReferenceType.SaleReturn,
            referenceId: saleReturn.id,
            createdBy: userId,
          });
          await manager.save(StockMovement, movement);
        }
      }

      // Loyalty reversal, proportional to this return's refundAmount share
      // of the original Sale's grandTotal — a real, derivable proportion,
      // never an arbitrary guess. Rounds down (floor) exactly like earning
      // does, so a reversal never claws back more points than were
      // demonstrably attributable to the returned amount.
      const saleGrandTotal = Number(sale.grandTotal);
      if (saleGrandTotal > 0) {
        const proportion = Number(saleReturn.refundAmount) / saleGrandTotal;
        const originalEarn = await manager.findOne(LoyaltyPointTransaction, {
          where: { companyId, sourceType: 'SALE', sourceId: sale.id },
        });
        if (originalEarn) {
          const reversalPoints = Math.floor(
            originalEarn.pointsDelta * Math.min(proportion, 1),
          );
          await this.loyaltyService.reverseForSaleReturn(
            manager,
            companyId,
            saleReturn.customerId,
            sale.id,
            saleReturn.id,
            reversalPoints,
            userId,
          );
        }
      }

      saleReturn.status = SaleReturnStatus.Confirmed;
      saleReturn.confirmedBy = userId;
      saleReturn.confirmedAt = new Date();
      await manager.save(SaleReturn, saleReturn);
      return await this.hydrateReturnOrFallback(
        manager,
        saleReturn.id,
        companyId,
        saleReturn,
      );
    });
  }

  /** DRAFT -> CANCELLED only. A CONFIRMED return already restocked inventory/reversed loyalty — see the status enum's own docblock for why that transition is not offered. */
  async cancel(id: string, companyId: string): Promise<SaleReturn> {
    return this.transactionService.run(async (manager) => {
      const saleReturn = await manager.findOne(SaleReturn, {
        where: { id, companyId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!saleReturn) {
        throw new AppException(ErrorCode.NotFound, 'Sale return not found');
      }
      if (saleReturn.status !== SaleReturnStatus.Draft) {
        throw new AppException(
          ErrorCode.UnprocessableEntity,
          `Cannot cancel a sale return in status ${saleReturn.status}`,
        );
      }
      saleReturn.status = SaleReturnStatus.Cancelled;
      await manager.save(SaleReturn, saleReturn);
      return await this.hydrateReturnOrFallback(
        manager,
        saleReturn.id,
        companyId,
        saleReturn,
      );
    });
  }

  /**
   * Applies a REFUND-direction payment's allocated amount to a CONFIRMED
   * SaleReturn — the exact mirror of SalesService.applyPayment()'s own
   * integration-point contract: takes the caller's EntityManager, never
   * opens its own transaction, locks the target row first. Rejects if the
   * allocation would push refundedAmount past refundAmount (prevents
   * refunding more than the eligible returned amount, including across
   * multiple partial-refund Payments and concurrent requests — the
   * pessimistic_write lock serializes concurrent allocations against the
   * same return exactly like Sale.applyPayment()'s own lock does).
   * Flips status to REFUNDED once refundedAmount reaches refundAmount.
   */
  async applyRefund(
    id: string,
    companyId: string,
    allocatedAmount: number,
    manager: EntityManager,
  ): Promise<void> {
    const saleReturn = await manager
      .createQueryBuilder(SaleReturn, 'saleReturn')
      .where('saleReturn.id = :id', { id })
      .andWhere('saleReturn.companyId = :companyId', { companyId })
      .setLock('pessimistic_write')
      .getOne();

    if (!saleReturn) {
      throw new AppException(ErrorCode.NotFound, 'Sale return not found');
    }
    if (
      saleReturn.status !== SaleReturnStatus.Confirmed &&
      saleReturn.status !== SaleReturnStatus.Refunded
    ) {
      throw new AppException(
        ErrorCode.UnprocessableEntity,
        `Cannot refund a sale return in status ${saleReturn.status}`,
      );
    }

    const currentRefunded = Number(saleReturn.refundedAmount);
    const eligible = Number(saleReturn.refundAmount);
    const newRefunded = currentRefunded + allocatedAmount;

    if (newRefunded > eligible + 1e-9) {
      throw new AppException(
        ErrorCode.Conflict,
        `Refunding ${allocatedAmount.toFixed(2)} against sale return ${id} would exceed its eligible refund amount (already refunded ${currentRefunded.toFixed(2)} of ${eligible.toFixed(2)})`,
      );
    }

    await manager.update(SaleReturn, saleReturn.id, {
      refundedAmount: newRefunded.toFixed(2),
      status:
        newRefunded >= eligible - 1e-9
          ? SaleReturnStatus.Refunded
          : SaleReturnStatus.Confirmed,
    });
  }

  private async generateReturnNumber(
    companyId: string,
    year: number,
    manager: EntityManager,
  ): Promise<string> {
    await retryOnDuplicateEntry(() =>
      manager.query(
        'INSERT INTO `company_sale_return_counters` (`id`, `company_id`, `year`, `last_sequence`) ' +
          'VALUES (?, ?, ?, 0) ' +
          'ON DUPLICATE KEY UPDATE `last_sequence` = `last_sequence`',
        [randomUUID(), companyId, year],
      ),
    );

    const counter = await manager
      .createQueryBuilder(CompanySaleReturnCounter, 'counter')
      .where('counter.companyId = :companyId', { companyId })
      .andWhere('counter.year = :year', { year })
      .setLock('pessimistic_write')
      .getOneOrFail();

    const nextSequence = counter.lastSequence + 1;
    await manager.update(CompanySaleReturnCounter, counter.id, {
      lastSequence: nextSequence,
    });
    return formatDocumentNumber('RET', year, nextSequence);
  }
}
