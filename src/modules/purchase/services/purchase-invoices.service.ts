import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { PurchaseOrder } from '../entities/purchase-order.entity';
import { PurchaseInvoice } from '../entities/purchase-invoice.entity';
import { GoodsReceipt } from '../../inventory/entities/goods-receipt.entity';
import { Supplier } from '../../customer-supplier/entities/supplier.entity';
import { ListPurchaseInvoicesDto } from '../dto/list-purchase-invoices.dto';
import { PurchaseInvoiceResponseDto } from '../dto/purchase-invoice-response.dto';
import { VoidPurchaseInvoiceDto } from '../dto/void-purchase-invoice.dto';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { PurchaseOrderStatus } from '../entities/purchase-order-status.enum';
import { PurchaseInvoiceStatus } from '../entities/purchase-invoice-status.enum';

@Injectable()
export class PurchaseInvoicesService {
  constructor(
    @InjectRepository(PurchaseInvoice)
    private readonly purchaseInvoiceRepository: Repository<PurchaseInvoice>,
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrderRepository: Repository<PurchaseOrder>,
    @InjectRepository(GoodsReceipt)
    private readonly goodsReceiptRepository: Repository<GoodsReceipt>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
  ) {}

  private deriveInvoiceNumber(purchaseOrderNumber: string): string {
    return purchaseOrderNumber.replace(/^PO-/, 'PINV-');
  }

  private buildDueDate(invoiceDate: Date, creditDays: number): Date {
    const dueDate = new Date(invoiceDate.getTime());
    dueDate.setUTCDate(dueDate.getUTCDate() + creditDays);
    return dueDate;
  }

  private isReleasedPurchaseOrder(status: PurchaseOrderStatus): boolean {
    return (
      status === PurchaseOrderStatus.Approved ||
      status === PurchaseOrderStatus.Confirmed ||
      status === PurchaseOrderStatus.Closed
    );
  }

  private resolvePaymentStatus(
    amountPaid: number,
    balanceAmount: number,
    grandTotal: number,
    dueDate: Date,
  ): PurchaseInvoiceResponseDto['paymentStatus'] {
    if (balanceAmount <= 0) {
      return 'PAID';
    }
    if (amountPaid > 0 && amountPaid < grandTotal) {
      return dueDate.getTime() < Date.now() ? 'OVERDUE' : 'PARTIAL';
    }
    return dueDate.getTime() < Date.now() ? 'OVERDUE' : 'UNPAID';
  }

  private mapInvoice(
    invoice: PurchaseInvoice,
    goodsReceipts: GoodsReceipt[],
  ): PurchaseInvoiceResponseDto {
    const amountPaid = Number(invoice.paidAmount);
    const creditedAmount = Number(invoice.creditedAmount);
    const balanceAmount = Number(invoice.balanceAmount);
    const grandTotal = Number(invoice.grandTotal);

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      supplierId: invoice.supplierId,
      purchaseOrderId: invoice.purchaseOrderId,
      goodsReceiptIds: goodsReceipts.map((receipt) => receipt.id),
      companyId: invoice.companyId,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      status: invoice.status,
      subtotal: invoice.subtotal,
      discountAmount: invoice.discountAmount,
      taxAmount: invoice.taxAmount,
      grandTotal: invoice.grandTotal,
      amountPaid: invoice.paidAmount,
      creditedAmount: invoice.creditedAmount,
      balanceAmount: invoice.balanceAmount,
      currency: invoice.currency,
      paymentStatus: this.resolvePaymentStatus(
        amountPaid,
        balanceAmount,
        grandTotal,
        invoice.dueDate,
      ),
      postedAt: invoice.postedAt,
      postedBy: invoice.postedBy,
      voidedAt: invoice.voidedAt,
      voidedBy: invoice.voidedBy,
      voidReason: invoice.voidReason,
    };
  }

  private async syncEligibleInvoices(
    companyId: string,
    supplierId?: string,
  ): Promise<void> {
    const orderQb = this.purchaseOrderRepository
      .createQueryBuilder('purchaseOrder')
      .where('purchaseOrder.companyId = :companyId', { companyId })
      .andWhere('purchaseOrder.status IN (:...statuses)', {
        statuses: [
          PurchaseOrderStatus.Approved,
          PurchaseOrderStatus.Confirmed,
          PurchaseOrderStatus.Closed,
        ],
      });

    if (supplierId) {
      orderQb.andWhere('purchaseOrder.supplierId = :supplierId', { supplierId });
    }

    const purchaseOrders = await orderQb.getMany();
    if (purchaseOrders.length === 0) {
      return;
    }

    const purchaseOrderIds = purchaseOrders.map((order) => order.id);
    const [goodsReceipts, suppliers, existingInvoices] = await Promise.all([
      this.goodsReceiptRepository.find({
        where: purchaseOrderIds.map((purchaseOrderId) => ({
          companyId,
          purchaseOrderId,
        })),
      }),
      this.supplierRepository.findBy({
        id: In([...new Set(purchaseOrders.map((order) => order.supplierId))]),
      }),
      this.purchaseInvoiceRepository.find({
        where: { companyId, purchaseOrderId: In(purchaseOrderIds) },
      }),
    ]);

    const goodsReceiptsByPurchaseOrder = new Map<string, GoodsReceipt[]>();
    for (const receipt of goodsReceipts) {
      const bucket =
        goodsReceiptsByPurchaseOrder.get(receipt.purchaseOrderId) ?? [];
      bucket.push(receipt);
      goodsReceiptsByPurchaseOrder.set(receipt.purchaseOrderId, bucket);
    }

    // A voided invoice is still a historical document for the purchase order.
    // Auto-recreating a replacement during read-time sync would reuse the same
    // derived invoice number and can violate the unique(companyId, invoiceNumber)
    // constraint. Reissue, if ever needed, must be an explicit workflow.
    const existingByPurchaseOrder = new Set(
      existingInvoices.map((invoice) => invoice.purchaseOrderId),
    );
    const suppliersById = new Map(suppliers.map((entry) => [entry.id, entry]));

    const newInvoices = purchaseOrders
      .filter(
        (order) =>
          goodsReceiptsByPurchaseOrder.has(order.id) &&
          !existingByPurchaseOrder.has(order.id),
      )
      .map((order) => {
        const relatedReceipts = goodsReceiptsByPurchaseOrder.get(order.id) ?? [];
        const firstReceiptDate = relatedReceipts
          .map((receipt) => receipt.receiptDate)
          .sort((a, b) => a.getTime() - b.getTime())[0];
        const invoiceDate = firstReceiptDate ?? order.transactionDate;
        const creditDays = suppliersById.get(order.supplierId)?.creditDays ?? 0;
        return this.purchaseInvoiceRepository.create({
          invoiceNumber: this.deriveInvoiceNumber(order.purchaseOrderNumber),
          companyId: order.companyId,
          supplierId: order.supplierId,
          purchaseOrderId: order.id,
          invoiceDate,
          dueDate: this.buildDueDate(invoiceDate, creditDays),
          status: PurchaseInvoiceStatus.Draft,
          subtotal: order.subtotal,
          discountAmount: order.discountAmount,
          taxAmount: order.taxAmount,
          grandTotal: order.grandTotal,
          paidAmount: order.paidAmount,
          creditedAmount: '0.00',
          balanceAmount: order.balanceAmount,
          currency: order.currency,
          createdBy: order.createdBy,
          updatedBy: order.updatedBy,
        });
      });

    if (newInvoices.length > 0) {
      await this.purchaseInvoiceRepository.save(newInvoices);
    }
  }

  async findAll(
    companyId: string,
    query: ListPurchaseInvoicesDto,
  ): Promise<{ data: PurchaseInvoiceResponseDto[]; meta: unknown }> {
    await this.syncEligibleInvoices(companyId, query.supplierId);

    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const where: { companyId: string; supplierId?: string } = { companyId };
    if (query.supplierId) {
      where.supplierId = query.supplierId;
    }

    const [invoices, total] = await this.purchaseInvoiceRepository.findAndCount({
      where,
      order: { invoiceDate: 'DESC', createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    if (invoices.length === 0) {
      return { data: [], meta: { page, limit, total: 0 } };
    }

    const goodsReceipts = await this.goodsReceiptRepository.find({
      where: invoices.map((invoice) => ({
        companyId,
        purchaseOrderId: invoice.purchaseOrderId,
      })),
    });
    const goodsReceiptsByPurchaseOrder = new Map<string, GoodsReceipt[]>();
    for (const receipt of goodsReceipts) {
      const bucket =
        goodsReceiptsByPurchaseOrder.get(receipt.purchaseOrderId) ?? [];
      bucket.push(receipt);
      goodsReceiptsByPurchaseOrder.set(receipt.purchaseOrderId, bucket);
    }

    return {
      data: invoices.map((invoice) =>
        this.mapInvoice(
          invoice,
          goodsReceiptsByPurchaseOrder.get(invoice.purchaseOrderId) ?? [],
        ),
      ),
      meta: { page, limit, total },
    };
  }

  async findByIdInCompany(
    id: string,
    companyId: string,
  ): Promise<PurchaseInvoiceResponseDto> {
    await this.syncEligibleInvoices(companyId);

    const invoice = await this.purchaseInvoiceRepository.findOne({
      where: { id, companyId },
    });
    if (!invoice) {
      throw new AppException(ErrorCode.NotFound, 'Purchase invoice not found');
    }

    const goodsReceipts = await this.goodsReceiptRepository.find({
      where: { companyId, purchaseOrderId: invoice.purchaseOrderId },
    });
    return this.mapInvoice(invoice, goodsReceipts);
  }

  private async findEntityByIdInCompany(
    id: string,
    companyId: string,
  ): Promise<PurchaseInvoice> {
    await this.syncEligibleInvoices(companyId);

    const invoice = await this.purchaseInvoiceRepository.findOne({
      where: { id, companyId },
    });
    if (!invoice) {
      throw new AppException(ErrorCode.NotFound, 'Purchase invoice not found');
    }
    return invoice;
  }

  async post(
    id: string,
    companyId: string,
    userId: string,
  ): Promise<PurchaseInvoiceResponseDto> {
    const invoice = await this.findEntityByIdInCompany(id, companyId);
    if (invoice.status !== PurchaseInvoiceStatus.Draft) {
      throw new AppException(
        ErrorCode.Conflict,
        `Cannot post a ${invoice.status} purchase invoice`,
      );
    }

    const [purchaseOrder, goodsReceipts] = await Promise.all([
      this.purchaseOrderRepository.findOne({
        where: { id: invoice.purchaseOrderId, companyId },
      }),
      this.goodsReceiptRepository.find({
        where: { companyId, purchaseOrderId: invoice.purchaseOrderId },
      }),
    ]);

    if (!purchaseOrder) {
      throw new AppException(
        ErrorCode.NotFound,
        'Purchase order linked to the invoice was not found',
      );
    }
    if (!this.isReleasedPurchaseOrder(purchaseOrder.status)) {
      throw new AppException(
        ErrorCode.Conflict,
        'Only approved purchase orders can be posted to AP invoices',
      );
    }
    if (goodsReceipts.length === 0) {
      throw new AppException(
        ErrorCode.Conflict,
        'Cannot post a purchase invoice before any goods receipt exists',
      );
    }

    invoice.status = PurchaseInvoiceStatus.Posted;
    invoice.postedAt = new Date();
    invoice.postedBy = userId;
    invoice.updatedBy = userId;
    const saved = await this.purchaseInvoiceRepository.save(invoice);
    return this.mapInvoice(saved, goodsReceipts);
  }

  async void(
    id: string,
    companyId: string,
    userId: string,
    dto: VoidPurchaseInvoiceDto,
  ): Promise<PurchaseInvoiceResponseDto> {
    const invoice = await this.findEntityByIdInCompany(id, companyId);
    if (invoice.status === PurchaseInvoiceStatus.Voided) {
      throw new AppException(
        ErrorCode.Conflict,
        'Purchase invoice is already voided',
      );
    }
    if (Number(invoice.paidAmount) > 1e-9 || Number(invoice.creditedAmount) > 1e-9) {
      throw new AppException(
        ErrorCode.Conflict,
        'Cannot void a purchase invoice that already has payment or credit activity',
      );
    }

    invoice.status = PurchaseInvoiceStatus.Voided;
    invoice.voidedAt = new Date();
    invoice.voidedBy = userId;
    invoice.voidReason = dto.reason;
    invoice.balanceAmount = '0.00';
    invoice.updatedBy = userId;
    const saved = await this.purchaseInvoiceRepository.save(invoice);
    return this.mapInvoice(saved, []);
  }

  async applyPayment(
    id: string,
    companyId: string,
    allocatedAmount: number,
    userId: string,
    manager: EntityManager,
  ): Promise<void> {
    const invoice = await manager
      .createQueryBuilder(PurchaseInvoice, 'purchaseInvoice')
      .where('purchaseInvoice.id = :id', { id })
      .andWhere('purchaseInvoice.companyId = :companyId', { companyId })
      .setLock('pessimistic_write')
      .getOne();

    if (!invoice) {
      throw new AppException(ErrorCode.NotFound, 'Purchase invoice not found');
    }

    if (invoice.status !== PurchaseInvoiceStatus.Posted) {
      throw new AppException(
        ErrorCode.Conflict,
        'Payments can only be applied to posted purchase invoices',
      );
    }

    const purchaseOrder = await manager
      .createQueryBuilder(PurchaseOrder, 'purchaseOrder')
      .where('purchaseOrder.id = :id', { id: invoice.purchaseOrderId })
      .andWhere('purchaseOrder.companyId = :companyId', { companyId })
      .setLock('pessimistic_write')
      .getOne();

    if (!purchaseOrder) {
      throw new AppException(
        ErrorCode.NotFound,
        'Purchase order linked to the invoice was not found',
      );
    }

    const currentPaid = Number(invoice.paidAmount);
    const creditedAmount = Number(invoice.creditedAmount);
    const grandTotal = Number(invoice.grandTotal);
    const effectiveTotal = grandTotal - creditedAmount;
    const newPaid = currentPaid + allocatedAmount;

    if (newPaid > effectiveTotal + 1e-9) {
      throw new AppException(
        ErrorCode.Conflict,
        `Allocating ${allocatedAmount.toFixed(2)} to purchase invoice ${id} would exceed its remaining payable amount (already paid ${currentPaid.toFixed(2)} of ${effectiveTotal.toFixed(2)})`,
      );
    }

    const newBalance = effectiveTotal - newPaid;
    const payload = {
      paidAmount: newPaid.toFixed(2),
      balanceAmount: newBalance.toFixed(2),
      updatedBy: userId,
    };

    await manager.update(PurchaseInvoice, invoice.id, payload);
    await manager.update(PurchaseOrder, purchaseOrder.id, payload);
  }

  async unapplyPayment(
    id: string,
    companyId: string,
    allocatedAmount: number,
    userId: string,
    manager: EntityManager,
  ): Promise<void> {
    const invoice = await manager
      .createQueryBuilder(PurchaseInvoice, 'purchaseInvoice')
      .where('purchaseInvoice.id = :id', { id })
      .andWhere('purchaseInvoice.companyId = :companyId', { companyId })
      .setLock('pessimistic_write')
      .getOne();

    if (!invoice) {
      throw new AppException(ErrorCode.NotFound, 'Purchase invoice not found');
    }

    const purchaseOrder = await manager
      .createQueryBuilder(PurchaseOrder, 'purchaseOrder')
      .where('purchaseOrder.id = :id', { id: invoice.purchaseOrderId })
      .andWhere('purchaseOrder.companyId = :companyId', { companyId })
      .setLock('pessimistic_write')
      .getOne();

    if (!purchaseOrder) {
      throw new AppException(
        ErrorCode.NotFound,
        'Purchase order linked to the invoice was not found',
      );
    }

    const currentPaid = Number(invoice.paidAmount);
    const newPaid = currentPaid - allocatedAmount;
    if (newPaid < -1e-9) {
      throw new AppException(
        ErrorCode.Conflict,
        `Reversing ${allocatedAmount.toFixed(2)} from purchase invoice ${id} would drive paid amount negative`,
      );
    }

    const creditedAmount = Number(invoice.creditedAmount);
    const effectiveTotal = Number(invoice.grandTotal) - creditedAmount;
    const payload = {
      paidAmount: Math.max(0, newPaid).toFixed(2),
      balanceAmount: (effectiveTotal - Math.max(0, newPaid)).toFixed(2),
      updatedBy: userId,
    };

    await manager.update(PurchaseInvoice, invoice.id, payload);
    await manager.update(PurchaseOrder, purchaseOrder.id, payload);
  }
}
