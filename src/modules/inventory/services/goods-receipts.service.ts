import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { EntityManager, Repository } from 'typeorm';
import { GoodsReceipt } from '../entities/goods-receipt.entity';
import { GoodsReceiptItem } from '../entities/goods-receipt-item.entity';
import { CompanyGoodsReceiptCounter } from '../entities/company-goods-receipt-counter.entity';
import { WarehouseStock } from '../entities/warehouse-stock.entity';
import { StockMovement } from '../entities/stock-movement.entity';
import { StockMovementType } from '../entities/stock-movement-type.enum';
import { StockMovementReferenceType } from '../entities/stock-movement-reference-type.enum';
import { CreateGoodsReceiptDto } from '../dto/create-goods-receipt.dto';
import { ListGoodsReceiptsDto } from '../dto/list-goods-receipts.dto';
import { formatDocumentNumber } from '../utils/document-number';
import { lockWarehouseStockRow } from '../utils/stock-lock';
import { retryOnDuplicateEntry } from '../utils/upsert-retry';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { PurchaseOrder } from '../../purchase/entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../purchase/entities/purchase-order-item.entity';
import { PurchaseOrderStatus } from '../../purchase/entities/purchase-order-status.enum';
import { WarehousesService } from '../../organization/services/warehouses.service';
import { WarehouseStatus } from '../../organization/entities/warehouse-status.enum';
import { ProductVariant } from '../../products/entities/product-variant.entity';
import { ProductVariantStatus } from '../../products/entities/product-variant-status.enum';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';

export interface PaginatedGoodsReceipts {
  data: GoodsReceipt[];
  meta: { page: number; limit: number; total: number };
}

/**
 * GoodsReceipt domain service (Phase 14 locked decision D2). Receiving is
 * a single TransactionService.run() call that: locks the relevant
 * PurchaseOrderItem row(s) (SELECT ... FOR UPDATE) before computing
 * remaining quantity, locks the relevant WarehouseStock row(s)
 * (upsert-then-lock), validates remaining quantity, increases stock,
 * writes a StockMovement(PURCHASE_RECEIPT) row, then creates the
 * GoodsReceipt/GoodsReceiptItem rows — all inside one transaction.
 *
 * No status column, no update/delete endpoint — a GoodsReceipt row
 * existing IS the completed receipt.
 */
@Injectable()
export class GoodsReceiptsService {
  constructor(
    @InjectRepository(GoodsReceipt)
    private readonly goodsReceiptRepository: Repository<GoodsReceipt>,
    private readonly transactionService: TransactionService,
    private readonly warehousesService: WarehousesService,
  ) {}

  async findAll(
    companyId: string,
    query: ListGoodsReceiptsDto,
  ): Promise<PaginatedGoodsReceipts> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;

    const qb = this.goodsReceiptRepository
      .createQueryBuilder('gr')
      .where('gr.companyId = :companyId', { companyId });

    if (query.purchaseOrderId) {
      qb.andWhere('gr.purchaseOrderId = :purchaseOrderId', {
        purchaseOrderId: query.purchaseOrderId,
      });
    }
    if (query.warehouseId) {
      qb.andWhere('gr.warehouseId = :warehouseId', {
        warehouseId: query.warehouseId,
      });
    }
    if (query.supplierId) {
      qb.andWhere('gr.supplierId = :supplierId', {
        supplierId: query.supplierId,
      });
    }

    qb.orderBy('gr.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { page, limit, total } };
  }

  async findByIdInCompany(
    id: string,
    companyId: string,
  ): Promise<GoodsReceipt> {
    const goodsReceipt = await this.goodsReceiptRepository.findOne({
      where: { id, companyId },
      relations: { items: true },
    });
    if (!goodsReceipt) {
      throw new AppException(ErrorCode.NotFound, 'Goods receipt not found');
    }
    return goodsReceipt;
  }

  private async generateReceiptNumber(
    companyId: string,
    year: number,
    manager: EntityManager,
  ): Promise<string> {
    await retryOnDuplicateEntry(() =>
      manager.query(
        'INSERT INTO `company_goods_receipt_counters` (`id`, `company_id`, `year`, `last_sequence`) ' +
          'VALUES (?, ?, ?, 0) ' +
          'ON DUPLICATE KEY UPDATE `last_sequence` = `last_sequence`',
        [randomUUID(), companyId, year],
      ),
    );

    const counter = await manager
      .createQueryBuilder(CompanyGoodsReceiptCounter, 'counter')
      .where('counter.companyId = :companyId', { companyId })
      .andWhere('counter.year = :year', { year })
      .setLock('pessimistic_write')
      .getOneOrFail();

    const nextSequence = counter.lastSequence + 1;
    // manager.update() is used instead of manager.save() here — save()
    // was found, via a real e2e concurrency test, to sometimes re-INSERT
    // this entity (raising a duplicate-key error on retry) instead of
    // UPDATEing it when the entity was hydrated via
    // createQueryBuilder().setLock().getOneOrFail() rather than a plain
    // repository find. update() is unambiguous — it always issues an
    // UPDATE against the given id, never an INSERT.
    await manager.update(CompanyGoodsReceiptCounter, counter.id, {
      lastSequence: nextSequence,
    });
    return formatDocumentNumber('GR', year, nextSequence);
  }

  /**
   * Creates a GoodsReceipt together with all of its GoodsReceiptItems, and
   * increases WarehouseStock for every line, inside a single
   * TransactionService.run() call. Any failure at any step rolls back
   * everything — no partial receiving, no stock mutation without a
   * matching GoodsReceipt row.
   */
  async create(
    companyId: string,
    userId: string,
    dto: CreateGoodsReceiptDto,
  ): Promise<GoodsReceipt> {
    // Warehouse must belong to the resolved company and be ACTIVE.
    const warehouse = await this.warehousesService.findById(dto.warehouseId);
    if (warehouse.status !== WarehouseStatus.Active) {
      throw new AppException(
        ErrorCode.ValidationError,
        'warehouseId does not reference an active warehouse',
      );
    }
    if (warehouse.companyId !== companyId) {
      throw new AppException(
        ErrorCode.ValidationError,
        'warehouseId does not belong to the resolved company',
      );
    }

    const receiptDate = dto.receiptDate
      ? new Date(dto.receiptDate)
      : new Date();
    const year = receiptDate.getUTCFullYear();

    return this.transactionService.run(async (manager) => {
      // PurchaseOrder must belong to the resolved company and be CONFIRMED.
      const purchaseOrder = await manager.findOne(PurchaseOrder, {
        where: { id: dto.purchaseOrderId, companyId },
      });
      if (!purchaseOrder) {
        throw new AppException(ErrorCode.NotFound, 'Purchase order not found');
      }
      if (purchaseOrder.status === PurchaseOrderStatus.Draft) {
        throw new AppException(
          ErrorCode.Conflict,
          'Cannot receive against a DRAFT purchase order — it must be CONFIRMED first',
        );
      }
      if (purchaseOrder.status === PurchaseOrderStatus.Cancelled) {
        throw new AppException(
          ErrorCode.Conflict,
          'Cannot receive against a CANCELLED purchase order',
        );
      }

      const receiptNumber = await this.generateReceiptNumber(
        companyId,
        year,
        manager,
      );

      const itemRows: Array<{
        purchaseOrderItemId: string;
        productVariantId: string;
        receivedQuantity: number;
        rejectedQuantity: number;
      }> = [];

      // Deterministic lock order: sort by purchaseOrderItemId to avoid
      // deadlocks between two concurrent receipts touching overlapping
      // item sets in different orders.
      const sortedItems = [...dto.items].sort((a, b) =>
        a.purchaseOrderItemId.localeCompare(b.purchaseOrderItemId),
      );

      for (const itemDto of sortedItems) {
        // Lock the PurchaseOrderItem row before computing remaining
        // quantity (Phase 14 locked decision D2/D19).
        const purchaseOrderItem = await manager
          .createQueryBuilder(PurchaseOrderItem, 'poi')
          .where('poi.id = :id', { id: itemDto.purchaseOrderItemId })
          .andWhere('poi.purchaseOrderId = :purchaseOrderId', {
            purchaseOrderId: dto.purchaseOrderId,
          })
          .setLock('pessimistic_write')
          .getOne();

        if (!purchaseOrderItem) {
          throw new AppException(
            ErrorCode.NotFound,
            `Purchase order item ${itemDto.purchaseOrderItemId} not found on this purchase order`,
          );
        }

        // The ProductVariant on the request must actually match the one on
        // the referenced PurchaseOrderItem — never let a client receive
        // against the wrong variant.
        if (purchaseOrderItem.productVariantId !== itemDto.productVariantId) {
          throw new AppException(
            ErrorCode.ValidationError,
            `productVariantId does not match purchase order item ${itemDto.purchaseOrderItemId}`,
          );
        }

        const variant = await manager.findOne(ProductVariant, {
          where: { id: itemDto.productVariantId, companyId },
        });
        if (!variant) {
          throw new AppException(
            ErrorCode.NotFound,
            `Product variant ${itemDto.productVariantId} not found`,
          );
        }
        if (variant.status !== ProductVariantStatus.Active) {
          throw new AppException(
            ErrorCode.ValidationError,
            `Product variant ${itemDto.productVariantId} is not active`,
          );
        }

        // Remaining quantity is always computed server-side, never stored
        // as a mutable column — SUM of all prior GoodsReceiptItem rows for
        // this PurchaseOrderItem, computed inside the same lock.
        //
        // This SUM must be a LOCKING read (setLock), not a plain SELECT.
        // MySQL's default REPEATABLE READ isolation gives plain SELECTs a
        // consistent snapshot taken at the start of the transaction — even
        // though this query runs AFTER the PurchaseOrderItem row was
        // locked with SELECT ... FOR UPDATE above, a plain (non-locking)
        // SUM here would still read that same stale per-transaction
        // snapshot and could under-count concurrently-committed prior
        // receipts, allowing over-receiving. Found via a real e2e
        // concurrency test (the over-subscribed 10-way GoodsReceipt test)
        // that deterministically let all 10 requests succeed instead of
        // the correct 6 once WarehouseStock locking was fixed separately
        // — the WarehouseStock lock made the earlier failure mode
        // disappear and exposed this pre-existing, previously-masked
        // snapshot-isolation bug in the remaining-quantity computation.
        // setLock('pessimistic_read') forces a fresh, latest-committed
        // read instead of the transaction's snapshot.
        const priorReceivedRaw = await manager
          .createQueryBuilder(GoodsReceiptItem, 'gri')
          .select('COALESCE(SUM(gri.receivedQuantity), 0)', 'total')
          .where('gri.purchaseOrderItemId = :purchaseOrderItemId', {
            purchaseOrderItemId: itemDto.purchaseOrderItemId,
          })
          .setLock('pessimistic_read')
          .getRawOne<{ total: string }>();
        const priorReceived = Number(priorReceivedRaw?.total ?? 0);
        const remaining = purchaseOrderItem.quantity - priorReceived;

        if (itemDto.receivedQuantity > remaining) {
          throw new AppException(
            ErrorCode.Conflict,
            `Cannot receive ${itemDto.receivedQuantity} for purchase order item ${itemDto.purchaseOrderItemId}: only ${remaining} remaining`,
          );
        }

        // Lock (upsert-then-lock) the WarehouseStock row, increase it, and
        // write a PURCHASE_RECEIPT movement — all inside this same
        // transaction/lock scope.
        const stock = await lockWarehouseStockRow(
          manager,
          dto.warehouseId,
          itemDto.productVariantId,
        );
        const newOnHandQuantity =
          stock.onHandQuantity + itemDto.receivedQuantity;
        // manager.update() rather than manager.save() — see
        // generateReceiptNumber()'s comment for why: save() on an entity
        // hydrated via createQueryBuilder().setLock().getOneOrFail() was
        // found (via a real e2e concurrency test) to sometimes issue a
        // duplicate INSERT instead of an UPDATE.
        await manager.update(WarehouseStock, stock.id, {
          onHandQuantity: newOnHandQuantity,
        });
        stock.onHandQuantity = newOnHandQuantity;

        itemRows.push({
          purchaseOrderItemId: itemDto.purchaseOrderItemId,
          productVariantId: itemDto.productVariantId,
          receivedQuantity: itemDto.receivedQuantity,
          rejectedQuantity: itemDto.rejectedQuantity ?? 0,
        });
      }

      const goodsReceipt = manager.create(GoodsReceipt, {
        receiptNumber,
        purchaseOrderId: dto.purchaseOrderId,
        warehouseId: dto.warehouseId,
        supplierId: purchaseOrder.supplierId,
        companyId,
        receiptDate,
        notes: dto.notes ?? null,
        receivedBy: userId,
      });
      const savedGoodsReceipt = await manager.save(GoodsReceipt, goodsReceipt);

      for (const row of itemRows) {
        const item = manager.create(GoodsReceiptItem, {
          goodsReceiptId: savedGoodsReceipt.id,
          ...row,
        });
        await manager.save(GoodsReceiptItem, item);

        // Write the movement AFTER the GoodsReceipt row exists so
        // referenceId is real; stock was already incremented above, so
        // quantityAfter reflects the just-locked row's post-increment value.
        const stock = await manager.findOneOrFail(WarehouseStock, {
          where: {
            warehouseId: dto.warehouseId,
            productVariantId: row.productVariantId,
          },
        });
        const movement = manager.create(StockMovement, {
          warehouseId: dto.warehouseId,
          productVariantId: row.productVariantId,
          movementType: StockMovementType.PurchaseReceipt,
          quantityChange: row.receivedQuantity,
          quantityAfter: stock.onHandQuantity,
          referenceType: StockMovementReferenceType.GoodsReceipt,
          referenceId: savedGoodsReceipt.id,
          createdBy: userId,
        });
        await manager.save(StockMovement, movement);
      }

      savedGoodsReceipt.items = await manager.find(GoodsReceiptItem, {
        where: { goodsReceiptId: savedGoodsReceipt.id },
      });
      return savedGoodsReceipt;
    });
  }
}
