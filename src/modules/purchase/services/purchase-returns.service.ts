import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, FindOptionsWhere, Repository } from 'typeorm';
import { PurchaseReturn } from '../entities/purchase-return.entity';
import { PurchaseReturnItem } from '../entities/purchase-return-item.entity';
import { PurchaseReturnStatus } from '../entities/purchase-return-status.enum';
import { CompanyPurchaseReturnCounter } from '../entities/company-purchase-return-counter.entity';
import { PurchaseInvoice } from '../entities/purchase-invoice.entity';
import { PurchaseOrder } from '../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../entities/purchase-order-item.entity';
import { GoodsReceiptItem } from '../../inventory/entities/goods-receipt-item.entity';
import { WarehouseStock } from '../../inventory/entities/warehouse-stock.entity';
import { StockMovement } from '../../inventory/entities/stock-movement.entity';
import { StockMovementType } from '../../inventory/entities/stock-movement-type.enum';
import { StockMovementReferenceType } from '../../inventory/entities/stock-movement-reference-type.enum';
import { lockWarehouseStockRow } from '../../inventory/utils/stock-lock';
import { retryOnDuplicateEntry } from '../../inventory/utils/upsert-retry';
import { formatDocumentNumber } from '../../inventory/utils/document-number';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  CreatePurchaseReturnDto,
  ListPurchaseReturnsDto,
} from '../dto/purchase-returns.dto';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';

@Injectable()
export class PurchaseReturnsService {
  constructor(
    @InjectRepository(PurchaseReturn)
    private readonly purchaseReturnRepository: Repository<PurchaseReturn>,
    @InjectRepository(PurchaseReturnItem)
    private readonly purchaseReturnItemRepository: Repository<PurchaseReturnItem>,
    private readonly transactionService: TransactionService,
  ) {}

  async findAll(
    companyId: string,
    query: ListPurchaseReturnsDto,
  ): Promise<{
    data: PurchaseReturn[];
    meta: { page: number; limit: number; total: number };
  }> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const where: FindOptionsWhere<PurchaseReturn> = {
      companyId,
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.purchaseInvoiceId
        ? { purchaseInvoiceId: query.purchaseInvoiceId }
        : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [data, total] = await this.purchaseReturnRepository.findAndCount({
      where,
      relations: {
        items: true,
        supplier: true,
        purchaseOrder: true,
        purchaseInvoice: true,
      },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, meta: { page, limit, total } };
  }

  async findByIdInCompany(
    id: string,
    companyId: string,
  ): Promise<PurchaseReturn> {
    const entity = await this.purchaseReturnRepository.findOne({
      where: { id, companyId },
      relations: {
        items: true,
        supplier: true,
        purchaseOrder: true,
        purchaseInvoice: true,
      },
    });
    if (!entity) {
      throw new AppException(ErrorCode.NotFound, 'Purchase return not found');
    }
    return entity;
  }

  private async loadWithRelations(
    manager: EntityManager,
    id: string,
    companyId: string,
  ): Promise<PurchaseReturn | null> {
    return manager.findOne(PurchaseReturn, {
      where: { id, companyId },
      relations: {
        items: true,
        supplier: true,
        purchaseOrder: true,
        purchaseInvoice: true,
      },
    });
  }

  private async hydrateOrFallback(
    manager: EntityManager,
    id: string,
    companyId: string,
    fallback: PurchaseReturn,
  ): Promise<PurchaseReturn> {
    return (await this.loadWithRelations(manager, id, companyId)) ?? fallback;
  }

  private async getReturnedQuantityForOrderItem(
    manager: EntityManager,
    purchaseOrderItemId: string,
  ): Promise<number> {
    const result = await manager
      .createQueryBuilder(PurchaseReturnItem, 'item')
      .innerJoin(
        PurchaseReturn,
        'purchaseReturn',
        'purchaseReturn.id = item.purchaseReturnId',
      )
      .select('COALESCE(SUM(item.quantity), 0)', 'returned')
      .where('item.purchaseOrderItemId = :purchaseOrderItemId', {
        purchaseOrderItemId,
      })
      .andWhere('purchaseReturn.status != :cancelled', {
        cancelled: PurchaseReturnStatus.Cancelled,
      })
      .getRawOne<{ returned: string }>();

    return Number(result?.returned ?? 0);
  }

  async create(
    companyId: string,
    userId: string,
    dto: CreatePurchaseReturnDto,
  ): Promise<PurchaseReturn> {
    return this.transactionService.run(async (manager) => {
      const invoice = await manager.findOne(PurchaseInvoice, {
        where: { id: dto.purchaseInvoiceId, companyId },
      });
      if (!invoice) {
        throw new AppException(
          ErrorCode.ValidationError,
          'purchaseInvoiceId does not reference a purchase invoice in the specified company',
        );
      }
      if (dto.supplierId !== invoice.supplierId) {
        throw new AppException(
          ErrorCode.ValidationError,
          'supplierId does not match the selected purchase invoice supplier',
        );
      }

      const purchaseOrder = await manager.findOne(PurchaseOrder, {
        where: { id: invoice.purchaseOrderId, companyId },
      });
      if (!purchaseOrder) {
        throw new AppException(
          ErrorCode.ValidationError,
          'The selected purchase invoice is missing its source purchase order',
        );
      }

      const receivedByOrderItemRows = await manager
        .createQueryBuilder(GoodsReceiptItem, 'item')
        .innerJoin(
          'item.goodsReceipt',
          'goodsReceipt',
          'goodsReceipt.companyId = :companyId',
          { companyId },
        )
        .select('item.purchaseOrderItemId', 'purchaseOrderItemId')
        .addSelect('COALESCE(SUM(item.receivedQuantity), 0)', 'received')
        .where('goodsReceipt.purchaseOrderId = :purchaseOrderId', {
          purchaseOrderId: purchaseOrder.id,
        })
        .groupBy('item.purchaseOrderItemId')
        .getRawMany<{ purchaseOrderItemId: string; received: string }>();
      const receivedByOrderItem = new Map(
        receivedByOrderItemRows.map((row) => [
          row.purchaseOrderItemId,
          Number(row.received),
        ]),
      );

      const sortedItems = [...dto.items].sort((a, b) =>
        a.purchaseOrderItemId.localeCompare(b.purchaseOrderItemId),
      );
      let subtotal = 0;
      const itemsToCreate: Array<{
        purchaseOrderItemId: string;
        productVariantId: string;
        quantity: number;
        unitCostSnapshot: string;
        lineTotal: string;
        productNameSnapshot: string;
        skuSnapshot: string;
      }> = [];

      for (const itemDto of sortedItems) {
        const purchaseOrderItem = await manager
          .createQueryBuilder(PurchaseOrderItem, 'purchaseOrderItem')
          .where('purchaseOrderItem.id = :id', { id: itemDto.purchaseOrderItemId })
          .andWhere('purchaseOrderItem.purchaseOrderId = :purchaseOrderId', {
            purchaseOrderId: purchaseOrder.id,
          })
          .setLock('pessimistic_write')
          .getOne();

        if (!purchaseOrderItem) {
          throw new AppException(
            ErrorCode.ValidationError,
            `purchaseOrderItemId ${itemDto.purchaseOrderItemId} does not belong to purchase order ${purchaseOrder.id}`,
          );
        }

        const receivedQuantity =
          receivedByOrderItem.get(purchaseOrderItem.id) ?? 0;
        if (receivedQuantity <= 0) {
          throw new AppException(
            ErrorCode.Conflict,
            `Purchase order item ${purchaseOrderItem.id} has no received quantity available to return`,
          );
        }

        const alreadyReturned = await this.getReturnedQuantityForOrderItem(
          manager,
          purchaseOrderItem.id,
        );
        const remainingReturnable = receivedQuantity - alreadyReturned;
        if (itemDto.quantity > remainingReturnable) {
          throw new AppException(
            ErrorCode.Conflict,
            `Cannot return ${itemDto.quantity} of purchase order item ${purchaseOrderItem.id}: only ${remainingReturnable} remain returnable`,
          );
        }

        const unitCost = Number(purchaseOrderItem.unitCostSnapshot);
        const lineTotal = unitCost * itemDto.quantity;
        subtotal += lineTotal;
        itemsToCreate.push({
          purchaseOrderItemId: purchaseOrderItem.id,
          productVariantId: purchaseOrderItem.productVariantId,
          quantity: itemDto.quantity,
          unitCostSnapshot: purchaseOrderItem.unitCostSnapshot,
          lineTotal: lineTotal.toFixed(2),
          productNameSnapshot: purchaseOrderItem.productNameSnapshot,
          skuSnapshot: purchaseOrderItem.skuSnapshot,
        });
      }

      const year = new Date().getUTCFullYear();
      const returnNumber = await this.generateReturnNumber(
        companyId,
        year,
        manager,
      );

      const purchaseReturn = manager.create(PurchaseReturn, {
        returnNumber,
        companyId,
        branchId: purchaseOrder.branchId,
        supplierId: invoice.supplierId,
        purchaseOrderId: purchaseOrder.id,
        purchaseInvoiceId: invoice.id,
        status: PurchaseReturnStatus.Draft,
        reason: dto.reason,
        notes: dto.notes ?? null,
        subtotal: subtotal.toFixed(2),
        creditAppliedAmount: '0.00',
        supplierCreditAmount: '0.00',
        currency: invoice.currency,
        createdBy: userId,
        completedBy: null,
        completedAt: null,
      });
      const savedReturn = await manager.save(PurchaseReturn, purchaseReturn);

      for (const row of itemsToCreate) {
        const item = manager.create(PurchaseReturnItem, {
          purchaseReturnId: savedReturn.id,
          ...row,
        });
        await manager.save(PurchaseReturnItem, item);
      }

      savedReturn.items = await manager.find(PurchaseReturnItem, {
        where: { purchaseReturnId: savedReturn.id },
      });
      return this.hydrateOrFallback(
        manager,
        savedReturn.id,
        companyId,
        savedReturn,
      );
    });
  }

  async complete(
    id: string,
    companyId: string,
    userId: string,
  ): Promise<PurchaseReturn> {
    return this.transactionService.run(async (manager) => {
      const purchaseReturn = await manager
        .createQueryBuilder(PurchaseReturn, 'purchaseReturn')
        .where('purchaseReturn.id = :id', { id })
        .andWhere('purchaseReturn.companyId = :companyId', { companyId })
        .setLock('pessimistic_write')
        .getOne();

      if (!purchaseReturn) {
        throw new AppException(ErrorCode.NotFound, 'Purchase return not found');
      }
      if (purchaseReturn.status !== PurchaseReturnStatus.Draft) {
        throw new AppException(
          ErrorCode.UnprocessableEntity,
          `Cannot complete a purchase return in status ${purchaseReturn.status}`,
        );
      }

      const invoice = await manager
        .createQueryBuilder(PurchaseInvoice, 'purchaseInvoice')
        .where('purchaseInvoice.id = :id', {
          id: purchaseReturn.purchaseInvoiceId,
        })
        .andWhere('purchaseInvoice.companyId = :companyId', { companyId })
        .setLock('pessimistic_write')
        .getOne();
      if (!invoice) {
        throw new AppException(
          ErrorCode.NotFound,
          'Purchase invoice linked to the return was not found',
        );
      }

      const purchaseOrder = await manager.findOne(PurchaseOrder, {
        where: { id: purchaseReturn.purchaseOrderId, companyId },
      });
      if (!purchaseOrder) {
        throw new AppException(
          ErrorCode.NotFound,
          'Purchase order linked to the return was not found',
        );
      }
      if (!purchaseOrder.warehouseId) {
        throw new AppException(
          ErrorCode.ValidationError,
          'This purchase order has no warehouse assigned, so the return cannot reduce stock automatically',
        );
      }

      const items = await manager.find(PurchaseReturnItem, {
        where: { purchaseReturnId: purchaseReturn.id },
      });
      const sortedItems = [...items].sort((a, b) =>
        a.productVariantId.localeCompare(b.productVariantId),
      );

      for (const item of sortedItems) {
        const stock = await lockWarehouseStockRow(
          manager,
          purchaseOrder.warehouseId,
          item.productVariantId,
        );
        if (stock.onHandQuantity < item.quantity) {
          throw new AppException(
            ErrorCode.Conflict,
            `Cannot complete return ${purchaseReturn.returnNumber}: warehouse stock for variant ${item.productVariantId} is only ${stock.onHandQuantity}`,
          );
        }

        stock.onHandQuantity -= item.quantity;
        await manager.update(WarehouseStock, stock.id, {
          onHandQuantity: stock.onHandQuantity,
        });

        const movement = manager.create(StockMovement, {
          warehouseId: purchaseOrder.warehouseId,
          productVariantId: item.productVariantId,
          movementType: StockMovementType.PurchaseReturn,
          quantityChange: -item.quantity,
          quantityAfter: stock.onHandQuantity,
          referenceType: StockMovementReferenceType.PurchaseReturn,
          referenceId: purchaseReturn.id,
          createdBy: userId,
        });
        await manager.save(StockMovement, movement);
      }

      const returnAmount = Number(purchaseReturn.subtotal);
      const previousBalance = Number(invoice.balanceAmount);
      const previousCredited = Number(invoice.creditedAmount);
      const creditAppliedAmount = Math.min(previousBalance, returnAmount);
      const supplierCreditAmount = Math.max(0, returnAmount - previousBalance);
      const newCreditedAmount = previousCredited + creditAppliedAmount;
      const newBalance = Math.max(
        0,
        Number(invoice.grandTotal) -
          Number(invoice.paidAmount) -
          newCreditedAmount,
      );

      await manager.update(PurchaseInvoice, invoice.id, {
        creditedAmount: newCreditedAmount.toFixed(2),
        balanceAmount: newBalance.toFixed(2),
        updatedBy: userId,
      });
      await manager.update(PurchaseOrder, purchaseOrder.id, {
        balanceAmount: newBalance.toFixed(2),
        updatedBy: userId,
      });

      purchaseReturn.status = PurchaseReturnStatus.Completed;
      purchaseReturn.creditAppliedAmount = creditAppliedAmount.toFixed(2);
      purchaseReturn.supplierCreditAmount = supplierCreditAmount.toFixed(2);
      purchaseReturn.completedBy = userId;
      purchaseReturn.completedAt = new Date();
      await manager.save(PurchaseReturn, purchaseReturn);

      return this.hydrateOrFallback(
        manager,
        purchaseReturn.id,
        companyId,
        purchaseReturn,
      );
    });
  }

  async cancel(id: string, companyId: string): Promise<PurchaseReturn> {
    return this.transactionService.run(async (manager) => {
      const purchaseReturn = await manager.findOne(PurchaseReturn, {
        where: { id, companyId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!purchaseReturn) {
        throw new AppException(ErrorCode.NotFound, 'Purchase return not found');
      }
      if (purchaseReturn.status !== PurchaseReturnStatus.Draft) {
        throw new AppException(
          ErrorCode.UnprocessableEntity,
          `Cannot cancel a purchase return in status ${purchaseReturn.status}`,
        );
      }
      purchaseReturn.status = PurchaseReturnStatus.Cancelled;
      await manager.save(PurchaseReturn, purchaseReturn);
      return this.hydrateOrFallback(
        manager,
        purchaseReturn.id,
        companyId,
        purchaseReturn,
      );
    });
  }

  private async generateReturnNumber(
    companyId: string,
    year: number,
    manager: EntityManager,
  ): Promise<string> {
    await retryOnDuplicateEntry(() =>
      manager.query(
        'INSERT INTO `company_purchase_return_counters` (`id`, `company_id`, `year`, `last_sequence`) ' +
          'VALUES (?, ?, ?, 0) ' +
          'ON DUPLICATE KEY UPDATE `last_sequence` = `last_sequence`',
        [randomUUID(), companyId, year],
      ),
    );

    const counter = await manager
      .createQueryBuilder(CompanyPurchaseReturnCounter, 'counter')
      .where('counter.companyId = :companyId', { companyId })
      .andWhere('counter.year = :year', { year })
      .setLock('pessimistic_write')
      .getOneOrFail();

    const nextSequence = counter.lastSequence + 1;
    await manager.update(CompanyPurchaseReturnCounter, counter.id, {
      lastSequence: nextSequence,
    });
    return formatDocumentNumber('PRTN', year, nextSequence);
  }
}
