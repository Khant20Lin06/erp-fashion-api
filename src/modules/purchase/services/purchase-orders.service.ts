import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { PurchaseOrder } from '../entities/purchase-order.entity';
import { GoodsReceipt } from '../../inventory/entities/goods-receipt.entity';
import { PurchaseOrderItem } from '../entities/purchase-order-item.entity';
import { PurchaseOrderStatus } from '../entities/purchase-order-status.enum';
import { PurchaseType } from '../entities/purchase-type.enum';
import { CompanyPurchaseCounter } from '../entities/company-purchase-counter.entity';
import { CreatePurchaseOrderDto } from '../dto/create-purchase-order.dto';
import { ListPurchaseOrdersDto } from '../dto/list-purchase-orders.dto';
import { RejectPurchaseOrderDto } from '../dto/reject-purchase-order.dto';
import { ClosePurchaseOrderDto } from '../dto/close-purchase-order.dto';
import { formatPurchaseOrderNumber } from '../utils/purchase-order-number';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { CompaniesService } from '../../organization/services/companies.service';
import { BranchesService } from '../../organization/services/branches.service';
import { WarehousesService } from '../../organization/services/warehouses.service';
import { WarehouseStatus } from '../../organization/entities/warehouse-status.enum';
import { SuppliersService } from '../../customer-supplier/services/suppliers.service';
import { SupplierStatus } from '../../customer-supplier/entities/supplier-status.enum';
import { PaymentTermsService } from '../../customer-supplier/services/payment-terms.service';
import { PaymentTermStatus } from '../../customer-supplier/entities/payment-term-status.enum';
import { ProductVariantsService } from '../../products/services/product-variants.service';
import { ProductVariantUomsService } from '../../products/services/product-variant-uoms.service';
import { ProductVariant } from '../../products/entities/product-variant.entity';
import { ProductVariantStatus } from '../../products/entities/product-variant-status.enum';
import { ProductVariantUomUsageType } from '../../products/entities/product-variant-uom-usage-type.enum';
import { SupplierQuotationsService } from './supplier-quotations.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { resolveSortField } from '../../../shared/dto/resolve-sort-field';

export interface PaginatedPurchaseOrders {
  data: PurchaseOrder[];
  meta: { page: number; limit: number; total: number };
}

const SORTABLE_FIELDS = [
  'createdAt',
  'transactionDate',
  'purchaseOrderNumber',
  'grandTotal',
  'status',
] as const;

/**
 * Valid PurchaseOrder lifecycle transitions (mirrors Sale's Phase 12 §E
 * locked decision exactly). DRAFT can move to CONFIRMED or CANCELLED;
 * CONFIRMED and CANCELLED are terminal. Every other transition is
 * rejected with 409.
 */
const ALLOWED_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> =
  {
    [PurchaseOrderStatus.Draft]: [
      PurchaseOrderStatus.Submitted,
      PurchaseOrderStatus.Approved,
      PurchaseOrderStatus.Confirmed,
      PurchaseOrderStatus.Cancelled,
    ],
    [PurchaseOrderStatus.Submitted]: [
      PurchaseOrderStatus.Approved,
      PurchaseOrderStatus.Confirmed,
      PurchaseOrderStatus.Rejected,
      PurchaseOrderStatus.Cancelled,
    ],
    [PurchaseOrderStatus.Approved]: [PurchaseOrderStatus.Closed],
    [PurchaseOrderStatus.Confirmed]: [PurchaseOrderStatus.Closed],
    [PurchaseOrderStatus.Rejected]: [],
    [PurchaseOrderStatus.Closed]: [],
    [PurchaseOrderStatus.Cancelled]: [],
  };

/**
 * Purchase domain service (Phase 13, locked decisions). PurchaseOrder
 * creation is a single TransactionService.run() call that: resolves/
 * validates company, supplier, branch/warehouse, payment term; locks and
 * increments the per-company/year purchase-order counter with
 * SELECT ... FOR UPDATE (the exact company_sale_counters pattern from
 * Phase 12, applied here); and computes every monetary total server-side
 * from the client-supplied (validated non-negative) unitCost/discount/tax
 * snapshot values. Unlike Sale, there is no PriceList resolution step —
 * Purchase has no equivalent pricing engine; the buyer supplies the actual
 * negotiated unitCost per line, validated but never re-derived. All
 * manager.create()/manager.save() calls inside run() use the transactional
 * EntityManager passed into the callback — never an injected Repository.
 *
 * No purchaserId/buyerId/requesterId attribution exists anywhere in this
 * service (Decision #9, LOCKED) — Purchase is fully independent of
 * SalesAccount/buyer-assignment concepts.
 */
@Injectable()
export class PurchaseOrdersService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrderRepository: Repository<PurchaseOrder>,
    @InjectRepository(GoodsReceipt)
    private readonly goodsReceiptRepository: Repository<GoodsReceipt>,
    private readonly transactionService: TransactionService,
    private readonly companiesService: CompaniesService,
    private readonly branchesService: BranchesService,
    private readonly warehousesService: WarehousesService,
    private readonly suppliersService: SuppliersService,
    private readonly paymentTermsService: PaymentTermsService,
    private readonly productVariantsService: ProductVariantsService,
    private readonly productVariantUomsService: ProductVariantUomsService,
    private readonly supplierQuotationsService: SupplierQuotationsService,
  ) {}

  private computeBaseQuantity(
    quantity: number,
    conversionFactorToBase: string,
    fieldName: string,
  ): number {
    const rawBaseQuantity = quantity * Number(conversionFactorToBase);
    const roundedBaseQuantity = Math.round(rawBaseQuantity);

    if (
      !Number.isFinite(rawBaseQuantity) ||
      rawBaseQuantity <= 0 ||
      Math.abs(rawBaseQuantity - roundedBaseQuantity) > 1e-9
    ) {
      throw new AppException(
        ErrorCode.ValidationError,
        `${fieldName} must convert to a whole positive base-unit quantity`,
      );
    }

    return roundedBaseQuantity;
  }

  async findAll(
    companyId: string,
    query: ListPurchaseOrdersDto,
  ): Promise<PaginatedPurchaseOrders> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const sortField = resolveSortField(
      query.sort,
      SORTABLE_FIELDS,
      'createdAt',
    );

    const qb = this.purchaseOrderRepository
      .createQueryBuilder('purchaseOrder')
      .leftJoinAndSelect('purchaseOrder.items', 'items')
      .loadRelationCountAndMap('purchaseOrder.itemCount', 'purchaseOrder.items')
      .where('purchaseOrder.companyId = :companyId', { companyId });

    if (query.branchId) {
      qb.andWhere('purchaseOrder.branchId = :branchId', {
        branchId: query.branchId,
      });
    }
    if (query.warehouseId) {
      qb.andWhere('purchaseOrder.warehouseId = :warehouseId', {
        warehouseId: query.warehouseId,
      });
    }
    if (query.supplierId) {
      qb.andWhere('purchaseOrder.supplierId = :supplierId', {
        supplierId: query.supplierId,
      });
    }
    if (query.status) {
      qb.andWhere('purchaseOrder.status = :status', { status: query.status });
    }
    if (query.purchaseType) {
      qb.andWhere('purchaseOrder.purchaseType = :purchaseType', {
        purchaseType: query.purchaseType,
      });
    }
    if (query.search) {
      qb.andWhere('purchaseOrder.purchaseOrderNumber LIKE :search', {
        search: `%${query.search}%`,
      });
    }

    qb.distinct(true)
      .orderBy(`purchaseOrder.${sortField}`, query.order ?? 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { page, limit, total } };
  }

  async findByIdInCompany(
    id: string,
    companyId: string,
  ): Promise<PurchaseOrder> {
    const purchaseOrder = await this.purchaseOrderRepository.findOne({
      where: { id, companyId },
      relations: { items: true },
    });
    if (!purchaseOrder) {
      throw new AppException(ErrorCode.NotFound, 'Purchase order not found');
    }
    return purchaseOrder;
  }

  private async assertValidBranch(
    branchId: string,
    companyId: string,
  ): Promise<void> {
    const branch = await this.branchesService.findActiveByIdOrNull(branchId);
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

  private async assertValidWarehouse(
    warehouseId: string,
    companyId: string,
    branchId: string | null,
  ): Promise<void> {
    const warehouse = await this.warehousesService.findById(warehouseId);
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
    if (branchId && warehouse.branchId !== branchId) {
      throw new AppException(
        ErrorCode.ValidationError,
        'warehouseId does not belong to the resolved branch',
      );
    }
  }

  /**
   * Supplier must exist, be non-deleted, and belong to the resolved
   * company (mirrors Sale's Customer validation, Phase 12) — a
   * cross-company or nonexistent supplier id is 404, matching the
   * established cross-company-hides-behind-404 (IDOR-safe) convention
   * (SuppliersService.findByIdInCompany reused verbatim, not re-derived).
   */
  private async assertValidSupplier(
    supplierId: string,
    companyId: string,
  ): Promise<void> {
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

  /**
   * PaymentTerm, when supplied, must exist and belong to the resolved
   * company (PaymentTermsService.findByIdInCompany reused verbatim, Phase
   * 11), and must be ACTIVE.
   */
  private async assertValidPaymentTerm(
    paymentTermId: string,
    companyId: string,
  ): Promise<void> {
    const term = await this.paymentTermsService.findByIdInCompany(
      paymentTermId,
      companyId,
    );
    if (term.status !== PaymentTermStatus.Active) {
      throw new AppException(
        ErrorCode.ValidationError,
        'paymentTermId must reference an active payment term',
      );
    }
  }

  /**
   * Locks (SELECT ... FOR UPDATE) and increments the company's per-year
   * purchase-order-number counter inside the caller's transaction, then
   * formats and returns the new purchase order number. Direct mirror of
   * SalesService.generateSaleNumber() (Phase 12) — never uses
   * SELECT MAX(purchase_order_number) + 1.
   */
  private async generatePurchaseOrderNumber(
    companyId: string,
    year: number,
    manager: EntityManager,
  ): Promise<string> {
    await manager.query(
      'INSERT INTO `company_purchase_counters` (`id`, `company_id`, `year`, `last_sequence`) ' +
        'VALUES (UUID(), ?, ?, 0) ' +
        'ON DUPLICATE KEY UPDATE `last_sequence` = `last_sequence`',
      [companyId, year],
    );

    const counter = await manager
      .createQueryBuilder(CompanyPurchaseCounter, 'counter')
      .where('counter.companyId = :companyId', { companyId })
      .andWhere('counter.year = :year', { year })
      .setLock('pessimistic_write')
      .getOneOrFail();

    counter.lastSequence += 1;
    await manager.save(CompanyPurchaseCounter, counter);
    return formatPurchaseOrderNumber(year, counter.lastSequence);
  }

  /**
   * Creates a PurchaseOrder together with all of its PurchaseOrderItems
   * inside a single TransactionService.run() call. Any failure at any step
   * rolls back everything — no partial PurchaseOrder/PurchaseOrderItem
   * rows can ever exist. unitCostSnapshot is always the client-supplied,
   * server-validated value — never resolved from ProductVariant.costPrice.
   */
  async create(
    companyId: string,
    userId: string,
    dto: CreatePurchaseOrderDto,
  ): Promise<PurchaseOrder> {
    const company = await this.companiesService.findActiveByIdOrNull(companyId);
    if (!company) {
      throw new AppException(
        ErrorCode.ValidationError,
        'companyId does not reference an active company',
      );
    }

    if (dto.branchId) {
      await this.assertValidBranch(dto.branchId, companyId);
    }
    if (dto.warehouseId) {
      await this.assertValidWarehouse(
        dto.warehouseId,
        companyId,
        dto.branchId ?? null,
      );
    }
    await this.assertValidSupplier(dto.supplierId, companyId);
    if (dto.paymentTermId) {
      await this.assertValidPaymentTerm(dto.paymentTermId, companyId);
    }
    if (dto.sourceSupplierQuotationId) {
      const quotation =
        await this.supplierQuotationsService.findAwardedByIdInCompany(
          dto.sourceSupplierQuotationId,
          companyId,
        );
      if (quotation.supplierId !== dto.supplierId) {
        throw new AppException(
          ErrorCode.ValidationError,
          'sourceSupplierQuotationId does not belong to the selected supplier',
        );
      }
    }

    // ProductVariant existence/company-scope is validated up front (before
    // the transaction) so a bad variant id fails fast with the same
    // findByIdInCompany 404 convention Phase 10 already established.
    for (const itemDto of dto.items) {
      const variant = await this.productVariantsService.findByIdInCompany(
        itemDto.productVariantId,
        companyId,
      );
      if (variant.status !== ProductVariantStatus.Active) {
        throw new AppException(
          ErrorCode.ValidationError,
          `Product variant ${itemDto.productVariantId} is not active`,
        );
      }
    }

    const transactionDate = dto.transactionDate
      ? new Date(dto.transactionDate)
      : new Date();
    const year = transactionDate.getUTCFullYear();

    return this.transactionService.run(async (manager) => {
      const purchaseOrderNumber = await this.generatePurchaseOrderNumber(
        companyId,
        year,
        manager,
      );

      let subtotal = 0;
      let discountTotal = 0;
      let taxTotal = 0;
      const itemRows: Array<{
        productVariantId: string;
        uomId: string | null;
        uomCodeSnapshot: string | null;
        uomNameSnapshot: string | null;
        quantity: number;
        baseQuantitySnapshot: number;
        unitCostSnapshot: string;
        conversionFactorToBaseSnapshot: string;
        discountSnapshot: string;
        taxSnapshot: string;
        lineTotal: string;
        productNameSnapshot: string;
        skuSnapshot: string;
      }> = [];

      for (const itemDto of dto.items) {
        const variant = await manager.findOneOrFail(ProductVariant, {
          where: { id: itemDto.productVariantId, companyId },
          relations: { product: true },
        });
        const selectedUom =
          await this.productVariantUomsService.resolveSelectionForUsage(
            variant,
            companyId,
            ProductVariantUomUsageType.Purchase,
            itemDto.uomId,
          );
        const baseQuantity = this.computeBaseQuantity(
          itemDto.quantity,
          selectedUom?.conversionFactorToBase ?? '1.0000',
          `quantity for product variant ${itemDto.productVariantId}`,
        );

        const unitCost = Number(itemDto.unitCost);
        const discount = Number(itemDto.discountAmount ?? '0');
        const tax = Number(itemDto.taxAmount ?? '0');
        if (unitCost < 0 || discount < 0 || tax < 0) {
          throw new AppException(
            ErrorCode.ValidationError,
            'unitCost, discountAmount, and taxAmount must be non-negative',
          );
        }

        const lineSubtotal = unitCost * itemDto.quantity;
        if (discount > lineSubtotal) {
          throw new AppException(
            ErrorCode.ValidationError,
            `discountAmount cannot exceed the line subtotal for product variant ${itemDto.productVariantId}`,
          );
        }
        const lineTotal = lineSubtotal - discount + tax;

        subtotal += lineSubtotal;
        discountTotal += discount;
        taxTotal += tax;

        itemRows.push({
          productVariantId: itemDto.productVariantId,
          uomId: selectedUom?.uomId ?? null,
          uomCodeSnapshot: selectedUom?.code ?? null,
          uomNameSnapshot: selectedUom?.name ?? null,
          quantity: itemDto.quantity,
          baseQuantitySnapshot: baseQuantity,
          unitCostSnapshot: unitCost.toFixed(2),
          conversionFactorToBaseSnapshot:
            selectedUom?.conversionFactorToBase ?? '1.0000',
          discountSnapshot: discount.toFixed(2),
          taxSnapshot: tax.toFixed(2),
          lineTotal: lineTotal.toFixed(2),
          productNameSnapshot: variant.product.name,
          skuSnapshot: variant.sku,
        });
      }

      const grandTotal = subtotal - discountTotal + taxTotal;

      const purchaseOrder = manager.create(PurchaseOrder, {
        purchaseOrderNumber,
        purchaseType: dto.purchaseType ?? PurchaseType.Standard,
        supplierId: dto.supplierId,
        companyId,
        branchId: dto.branchId ?? null,
        warehouseId: dto.warehouseId ?? null,
        paymentTermId: dto.paymentTermId ?? null,
        sourceSupplierQuotationId: dto.sourceSupplierQuotationId ?? null,
        transactionDate,
        expectedDeliveryDate: dto.expectedDeliveryDate
          ? new Date(dto.expectedDeliveryDate)
          : null,
        status: PurchaseOrderStatus.Draft,
        subtotal: subtotal.toFixed(2),
        discountAmount: discountTotal.toFixed(2),
        taxAmount: taxTotal.toFixed(2),
        grandTotal: grandTotal.toFixed(2),
        paidAmount: '0.00',
        balanceAmount: grandTotal.toFixed(2),
        currency: dto.currency,
        notes: dto.notes ?? null,
        createdBy: userId,
        updatedBy: userId,
      });
      const savedPurchaseOrder = await manager.save(
        PurchaseOrder,
        purchaseOrder,
      );

      for (const row of itemRows) {
        const item = manager.create(PurchaseOrderItem, {
          purchaseOrderId: savedPurchaseOrder.id,
          ...row,
        });
        await manager.save(PurchaseOrderItem, item);
      }

      savedPurchaseOrder.items = await manager.find(PurchaseOrderItem, {
        where: { purchaseOrderId: savedPurchaseOrder.id },
      });
      return savedPurchaseOrder;
    });
  }

  private assertTransitionAllowed(
    current: PurchaseOrderStatus,
    target: PurchaseOrderStatus,
  ): void {
    const allowed = ALLOWED_TRANSITIONS[current] ?? [];
    if (!allowed.includes(target)) {
      throw new AppException(
        ErrorCode.Conflict,
        `Cannot transition purchase order from ${current} to ${target}`,
      );
    }
  }

  private isReleasedStatus(status: PurchaseOrderStatus): boolean {
    return (
      status === PurchaseOrderStatus.Approved ||
      status === PurchaseOrderStatus.Confirmed
    );
  }

  private async assertCloseable(
    purchaseOrder: PurchaseOrder,
    companyId: string,
  ): Promise<void> {
    const receipts = await this.goodsReceiptRepository.find({
      where: { purchaseOrderId: purchaseOrder.id, companyId },
      relations: { items: true },
    });
    if (receipts.length === 0) {
      throw new AppException(
        ErrorCode.Conflict,
        'Cannot close a purchase order that has no goods receipts',
      );
    }

    const handledByItemId = new Map<string, number>();
    for (const receipt of receipts) {
      for (const item of receipt.items ?? []) {
        handledByItemId.set(
          item.purchaseOrderItemId,
          (handledByItemId.get(item.purchaseOrderItemId) ?? 0) +
            item.receivedQuantity +
            item.rejectedQuantity,
        );
      }
    }

    const hasOutstandingQuantity = (purchaseOrder.items ?? []).some(
      (item) => (handledByItemId.get(item.id) ?? 0) < item.quantity,
    );
    if (hasOutstandingQuantity) {
      throw new AppException(
        ErrorCode.Conflict,
        'Cannot close a purchase order that still has outstanding receipt quantities',
      );
    }

    if (Number(purchaseOrder.balanceAmount) > 1e-9) {
      throw new AppException(
        ErrorCode.Conflict,
        'Cannot close a purchase order with an outstanding payable balance',
      );
    }
  }

  async submit(
    id: string,
    companyId: string,
    userId: string,
  ): Promise<PurchaseOrder> {
    const purchaseOrder = await this.findByIdInCompany(id, companyId);
    this.assertTransitionAllowed(
      purchaseOrder.status,
      PurchaseOrderStatus.Submitted,
    );
    purchaseOrder.status = PurchaseOrderStatus.Submitted;
    purchaseOrder.submittedAt = new Date();
    purchaseOrder.submittedBy = userId;
    purchaseOrder.updatedBy = userId;
    return this.purchaseOrderRepository.save(purchaseOrder);
  }

  async approve(
    id: string,
    companyId: string,
    userId: string,
  ): Promise<PurchaseOrder> {
    const purchaseOrder = await this.findByIdInCompany(id, companyId);
    this.assertTransitionAllowed(
      purchaseOrder.status,
      PurchaseOrderStatus.Approved,
    );
    purchaseOrder.status = PurchaseOrderStatus.Approved;
    purchaseOrder.submittedAt = purchaseOrder.submittedAt ?? new Date();
    purchaseOrder.submittedBy = purchaseOrder.submittedBy ?? userId;
    purchaseOrder.approvedAt = new Date();
    purchaseOrder.approvedBy = userId;
    purchaseOrder.updatedBy = userId;
    return this.purchaseOrderRepository.save(purchaseOrder);
  }

  async confirm(
    id: string,
    companyId: string,
    userId: string,
  ): Promise<PurchaseOrder> {
    const purchaseOrder = await this.findByIdInCompany(id, companyId);
    this.assertTransitionAllowed(
      purchaseOrder.status,
      PurchaseOrderStatus.Confirmed,
    );
    purchaseOrder.status = PurchaseOrderStatus.Confirmed;
    purchaseOrder.approvedAt = purchaseOrder.approvedAt ?? new Date();
    purchaseOrder.approvedBy = purchaseOrder.approvedBy ?? userId;
    purchaseOrder.submittedAt = purchaseOrder.submittedAt ?? new Date();
    purchaseOrder.submittedBy = purchaseOrder.submittedBy ?? userId;
    purchaseOrder.updatedBy = userId;
    return this.purchaseOrderRepository.save(purchaseOrder);
  }

  async reject(
    id: string,
    companyId: string,
    userId: string,
    dto: RejectPurchaseOrderDto,
  ): Promise<PurchaseOrder> {
    const purchaseOrder = await this.findByIdInCompany(id, companyId);
    this.assertTransitionAllowed(
      purchaseOrder.status,
      PurchaseOrderStatus.Rejected,
    );
    purchaseOrder.status = PurchaseOrderStatus.Rejected;
    purchaseOrder.rejectedAt = new Date();
    purchaseOrder.rejectedBy = userId;
    purchaseOrder.rejectedReason = dto.reason;
    purchaseOrder.updatedBy = userId;
    return this.purchaseOrderRepository.save(purchaseOrder);
  }

  async close(
    id: string,
    companyId: string,
    userId: string,
    dto: ClosePurchaseOrderDto,
  ): Promise<PurchaseOrder> {
    const purchaseOrder = await this.findByIdInCompany(id, companyId);
    this.assertTransitionAllowed(
      purchaseOrder.status,
      PurchaseOrderStatus.Closed,
    );
    await this.assertCloseable(purchaseOrder, companyId);
    purchaseOrder.status = PurchaseOrderStatus.Closed;
    purchaseOrder.closedAt = new Date();
    purchaseOrder.closedBy = userId;
    purchaseOrder.closeReason = dto.reason ?? null;
    purchaseOrder.updatedBy = userId;
    return this.purchaseOrderRepository.save(purchaseOrder);
  }

  /**
   * DRAFT -> CANCELLED only. Additive Phase 14 check: a PurchaseOrder with
   * any GoodsReceipt already recorded against it (Phase 14, LOCKED) must
   * NOT be cancelled — receiving has already increased real warehouse
   * stock, so cancelling the order afterward would leave that stock
   * increase attached to a cancelled purchase, which is a business-rule
   * violation (409), checked before the existing transition-table check
   * fires so the more specific error is reported first.
   */
  async cancel(
    id: string,
    companyId: string,
    userId: string,
  ): Promise<PurchaseOrder> {
    const purchaseOrder = await this.findByIdInCompany(id, companyId);

    const existingReceiptCount = await this.goodsReceiptRepository.count({
      where: { purchaseOrderId: id },
    });
    if (existingReceiptCount > 0) {
      throw new AppException(
        ErrorCode.Conflict,
        'Cannot cancel a purchase order that already has a goods receipt recorded against it',
      );
    }

    this.assertTransitionAllowed(
      purchaseOrder.status,
      PurchaseOrderStatus.Cancelled,
    );
    purchaseOrder.status = PurchaseOrderStatus.Cancelled;
    purchaseOrder.updatedBy = userId;
    return this.purchaseOrderRepository.save(purchaseOrder);
  }

  /**
   * Phase 16 (Payment) integration point — D16, EXPLICITLY AUTHORIZED
   * cross-phase addition, direct mirror of SalesService.applyPayment()
   * (see that method's docblock for the full rationale). Applies a
   * newly-allocated payment amount to this PurchaseOrder's paidAmount/
   * balanceAmount, participating in the CALLER's transaction. The caller
   * (PaymentsService) is responsible for the deterministic cross-document
   * lock ordering; this method locks only this single row
   * (SELECT ... FOR UPDATE) and updates it via manager.update() — never
   * manager.save() on a lock-hydrated entity, the same bug class Phase 14
   * found and fixed (see GoodsReceiptsService's comments). Over-allocation
   * is rejected with 409, rolling back the caller's entire transaction.
   */
  async applyPayment(
    id: string,
    companyId: string,
    allocatedAmount: number,
    userId: string,
    manager: EntityManager,
  ): Promise<void> {
    const purchaseOrder = await manager
      .createQueryBuilder(PurchaseOrder, 'purchaseOrder')
      .where('purchaseOrder.id = :id', { id })
      .andWhere('purchaseOrder.companyId = :companyId', { companyId })
      .setLock('pessimistic_write')
      .getOne();

    if (!purchaseOrder) {
      throw new AppException(ErrorCode.NotFound, 'Purchase order not found');
    }

    if (!this.isReleasedStatus(purchaseOrder.status)) {
      throw new AppException(
        ErrorCode.Conflict,
        'Payments can only be applied to an approved purchase order',
      );
    }

    const currentPaid = Number(purchaseOrder.paidAmount);
    const grandTotal = Number(purchaseOrder.grandTotal);
    const newPaid = currentPaid + allocatedAmount;

    if (newPaid > grandTotal + 1e-9) {
      throw new AppException(
        ErrorCode.Conflict,
        `Allocating ${allocatedAmount.toFixed(2)} to purchase order ${id} would exceed its grand total (already paid ${currentPaid.toFixed(2)} of ${grandTotal.toFixed(2)})`,
      );
    }

    const newBalance = grandTotal - newPaid;

    await manager.update(PurchaseOrder, purchaseOrder.id, {
      paidAmount: newPaid.toFixed(2),
      balanceAmount: newBalance.toFixed(2),
      updatedBy: userId,
    });
  }
}
