import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { EntityManager, Repository } from 'typeorm';
import { StockTransfer } from '../entities/stock-transfer.entity';
import { StockTransferItem } from '../entities/stock-transfer-item.entity';
import { CompanyStockTransferCounter } from '../entities/company-stock-transfer-counter.entity';
import { WarehouseStock } from '../entities/warehouse-stock.entity';
import { StockMovement } from '../entities/stock-movement.entity';
import { StockMovementType } from '../entities/stock-movement-type.enum';
import { StockMovementReferenceType } from '../entities/stock-movement-reference-type.enum';
import { CreateStockTransferDto } from '../dto/create-stock-transfer.dto';
import { ListStockTransfersDto } from '../dto/list-stock-transfers.dto';
import { formatDocumentNumber } from '../utils/document-number';
import { lockWarehouseStockRows, stockKey } from '../utils/stock-lock';
import { retryOnDuplicateEntry } from '../utils/upsert-retry';
import { TransactionService } from '../../../core/transaction/transaction.service';
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

export interface PaginatedStockTransfers {
  data: StockTransfer[];
  meta: { page: number; limit: number; total: number };
}

/**
 * StockTransfer domain service (Phase 14 locked decision D9). Single-step
 * atomic — creation is the whole lifecycle. Locks ALL required
 * WarehouseStock rows (source rows for every item + destination rows for
 * every item) in deterministic (warehouseId, productVariantId) order
 * BEFORE acquiring any lock, to prevent the classic two-transaction
 * deadlock where transfer A locks warehouse-1-then-2 while a concurrent
 * transfer B locks warehouse-2-then-1.
 */
@Injectable()
export class StockTransfersService {
  constructor(
    @InjectRepository(StockTransfer)
    private readonly stockTransferRepository: Repository<StockTransfer>,
    private readonly transactionService: TransactionService,
    private readonly warehousesService: WarehousesService,
  ) {}

  async findAll(
    companyId: string,
    query: ListStockTransfersDto,
  ): Promise<PaginatedStockTransfers> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;

    const qb = this.stockTransferRepository
      .createQueryBuilder('st')
      .where('st.companyId = :companyId', { companyId });

    if (query.sourceWarehouseId) {
      qb.andWhere('st.sourceWarehouseId = :sourceWarehouseId', {
        sourceWarehouseId: query.sourceWarehouseId,
      });
    }
    if (query.destinationWarehouseId) {
      qb.andWhere('st.destinationWarehouseId = :destinationWarehouseId', {
        destinationWarehouseId: query.destinationWarehouseId,
      });
    }

    qb.orderBy('st.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { page, limit, total } };
  }

  async findByIdInCompany(
    id: string,
    companyId: string,
  ): Promise<StockTransfer> {
    const transfer = await this.stockTransferRepository.findOne({
      where: { id, companyId },
      relations: { items: true },
    });
    if (!transfer) {
      throw new AppException(ErrorCode.NotFound, 'Stock transfer not found');
    }
    return transfer;
  }

  private async generateTransferNumber(
    companyId: string,
    year: number,
    manager: EntityManager,
  ): Promise<string> {
    await retryOnDuplicateEntry(() =>
      manager.query(
        'INSERT INTO `company_stock_transfer_counters` (`id`, `company_id`, `year`, `last_sequence`) ' +
          'VALUES (?, ?, ?, 0) ' +
          'ON DUPLICATE KEY UPDATE `last_sequence` = `last_sequence`',
        [randomUUID(), companyId, year],
      ),
    );

    const counter = await manager
      .createQueryBuilder(CompanyStockTransferCounter, 'counter')
      .where('counter.companyId = :companyId', { companyId })
      .andWhere('counter.year = :year', { year })
      .setLock('pessimistic_write')
      .getOneOrFail();

    const nextSequence = counter.lastSequence + 1;
    // manager.update() rather than manager.save() — see
    // GoodsReceiptsService.generateReceiptNumber()'s comment for why:
    // save() on an entity hydrated via
    // createQueryBuilder().setLock().getOneOrFail() was found (via a real
    // e2e concurrency test) to sometimes issue a duplicate INSERT instead
    // of an UPDATE.
    await manager.update(CompanyStockTransferCounter, counter.id, {
      lastSequence: nextSequence,
    });
    return formatDocumentNumber('TRF', year, nextSequence);
  }

  async create(
    companyId: string,
    userId: string,
    dto: CreateStockTransferDto,
  ): Promise<StockTransfer> {
    if (dto.sourceWarehouseId === dto.destinationWarehouseId) {
      throw new AppException(
        ErrorCode.ValidationError,
        'sourceWarehouseId and destinationWarehouseId must be different',
      );
    }

    const sourceWarehouse = await this.warehousesService.findById(
      dto.sourceWarehouseId,
    );
    const destinationWarehouse = await this.warehousesService.findById(
      dto.destinationWarehouseId,
    );

    for (const [label, warehouse] of [
      ['sourceWarehouseId', sourceWarehouse] as const,
      ['destinationWarehouseId', destinationWarehouse] as const,
    ]) {
      if (warehouse.status !== WarehouseStatus.Active) {
        throw new AppException(
          ErrorCode.ValidationError,
          `${label} does not reference an active warehouse`,
        );
      }
      if (warehouse.companyId !== companyId) {
        throw new AppException(
          ErrorCode.ValidationError,
          `${label} does not belong to the resolved company`,
        );
      }
    }

    const year = new Date().getUTCFullYear();

    return this.transactionService.run(async (manager) => {
      const transferNumber = await this.generateTransferNumber(
        companyId,
        year,
        manager,
      );

      // Validate every ProductVariant belongs to the company and is ACTIVE.
      for (const itemDto of dto.items) {
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
      }

      // Build the full set of lock targets (source rows for every item +
      // destination rows for every item), then sort by
      // (warehouseId, productVariantId) tuple BEFORE acquiring any lock —
      // this is the deadlock-prevention step (D9, LOCKED).
      const lockTargets = [
        ...dto.items.map((item) => ({
          warehouseId: dto.sourceWarehouseId,
          productVariantId: item.productVariantId,
        })),
        ...dto.items.map((item) => ({
          warehouseId: dto.destinationWarehouseId,
          productVariantId: item.productVariantId,
        })),
      ].sort((a, b) => {
        const warehouseCompare = a.warehouseId.localeCompare(b.warehouseId);
        if (warehouseCompare !== 0) return warehouseCompare;
        return a.productVariantId.localeCompare(b.productVariantId);
      });

      const lockedRows = await lockWarehouseStockRows(manager, lockTargets);

      // Validate source sufficiency for every item (strict no-negative,
      // D7) BEFORE any mutation.
      for (const item of dto.items) {
        const sourceRow = lockedRows.get(
          stockKey(dto.sourceWarehouseId, item.productVariantId),
        );
        if (!sourceRow || sourceRow.onHandQuantity < item.quantity) {
          throw new AppException(
            ErrorCode.Conflict,
            `Insufficient stock for product variant ${item.productVariantId} in the source warehouse`,
          );
        }
      }

      // Decrease source, increase destination, write TRANSFER_OUT +
      // TRANSFER_IN movements per item.
      for (const item of dto.items) {
        const sourceRow = lockedRows.get(
          stockKey(dto.sourceWarehouseId, item.productVariantId),
        )!;
        const destinationRow = lockedRows.get(
          stockKey(dto.destinationWarehouseId, item.productVariantId),
        )!;

        sourceRow.onHandQuantity -= item.quantity;
        destinationRow.onHandQuantity += item.quantity;
        // manager.update() rather than manager.save() — see
        // GoodsReceiptsService's comment for why.
        await manager.update(WarehouseStock, sourceRow.id, {
          onHandQuantity: sourceRow.onHandQuantity,
        });
        await manager.update(WarehouseStock, destinationRow.id, {
          onHandQuantity: destinationRow.onHandQuantity,
        });
      }

      const stockTransfer = manager.create(StockTransfer, {
        transferNumber,
        sourceWarehouseId: dto.sourceWarehouseId,
        destinationWarehouseId: dto.destinationWarehouseId,
        companyId,
        notes: dto.notes ?? null,
        createdBy: userId,
      });
      const savedTransfer = await manager.save(StockTransfer, stockTransfer);

      for (const item of dto.items) {
        const transferItem = manager.create(StockTransferItem, {
          stockTransferId: savedTransfer.id,
          productVariantId: item.productVariantId,
          quantity: item.quantity,
        });
        await manager.save(StockTransferItem, transferItem);

        const sourceRow = lockedRows.get(
          stockKey(dto.sourceWarehouseId, item.productVariantId),
        )!;
        const destinationRow = lockedRows.get(
          stockKey(dto.destinationWarehouseId, item.productVariantId),
        )!;

        const outMovement = manager.create(StockMovement, {
          warehouseId: dto.sourceWarehouseId,
          productVariantId: item.productVariantId,
          movementType: StockMovementType.TransferOut,
          quantityChange: -item.quantity,
          quantityAfter: sourceRow.onHandQuantity,
          referenceType: StockMovementReferenceType.StockTransfer,
          referenceId: savedTransfer.id,
          createdBy: userId,
        });
        await manager.save(StockMovement, outMovement);

        const inMovement = manager.create(StockMovement, {
          warehouseId: dto.destinationWarehouseId,
          productVariantId: item.productVariantId,
          movementType: StockMovementType.TransferIn,
          quantityChange: item.quantity,
          quantityAfter: destinationRow.onHandQuantity,
          referenceType: StockMovementReferenceType.StockTransfer,
          referenceId: savedTransfer.id,
          createdBy: userId,
        });
        await manager.save(StockMovement, inMovement);
      }

      savedTransfer.items = await manager.find(StockTransferItem, {
        where: { stockTransferId: savedTransfer.id },
      });
      return savedTransfer;
    });
  }
}
