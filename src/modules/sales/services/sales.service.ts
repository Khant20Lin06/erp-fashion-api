import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EntityManager,
  IsNull,
  LessThanOrEqual,
  MoreThan,
  Repository,
} from 'typeorm';
import { Sale } from '../entities/sale.entity';
import { SaleItem } from '../entities/sale-item.entity';
import { SaleStatus } from '../entities/sale-status.enum';
import { SaleType } from '../entities/sale-type.enum';
import { CompanySaleCounter } from '../entities/company-sale-counter.entity';
import { WarehouseStock } from '../../inventory/entities/warehouse-stock.entity';
import { StockMovement } from '../../inventory/entities/stock-movement.entity';
import { StockMovementType } from '../../inventory/entities/stock-movement-type.enum';
import { StockMovementReferenceType } from '../../inventory/entities/stock-movement-reference-type.enum';
import { lockWarehouseStockRow } from '../../inventory/utils/stock-lock';
import { CreateSaleDto } from '../dto/create-sale.dto';
import { CreateSaleItemDto } from '../dto/create-sale-item.dto';
import { ListSalesDto } from '../dto/list-sales.dto';
import { formatSaleNumber } from '../utils/sale-number';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { CompaniesService } from '../../organization/services/companies.service';
import { BranchesService } from '../../organization/services/branches.service';
import { WarehousesService } from '../../organization/services/warehouses.service';
import { WarehouseStatus } from '../../organization/entities/warehouse-status.enum';
import { CustomersService } from '../../customer-supplier/services/customers.service';
import { CustomerStatus } from '../../customer-supplier/entities/customer-status.enum';
import { ProductVariantsService } from '../../products/services/product-variants.service';
import { ProductVariant } from '../../products/entities/product-variant.entity';
import { ProductVariantStatus } from '../../products/entities/product-variant-status.enum';
import { PriceList } from '../../products/entities/price-list.entity';
import { PriceListStatus } from '../../products/entities/price-list-status.enum';
import { PriceListItem } from '../../products/entities/price-list-item.entity';
import { PriceListItemStatus } from '../../products/entities/price-list-item-status.enum';
import { SalesAccount } from '../../sales-accounts/entities/sales-account.entity';
import { SalesAccountStatus } from '../../sales-accounts/entities/sales-account-status.enum';
import { SalesAccountAccessService } from '../../sales-accounts/services/sales-account-access.service';
import { LoyaltyService } from '../../loyalty/services/loyalty.service';
import { PromotionsService } from '../../promotions/services/promotions.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { resolveSortField } from '../../../shared/dto/resolve-sort-field';

export interface PaginatedSales {
  data: Sale[];
  meta: { page: number; limit: number; total: number };
}

const SORTABLE_FIELDS = [
  'createdAt',
  'transactionDate',
  'saleNumber',
  'grandTotal',
  'status',
] as const;

/**
 * Valid Sale lifecycle transitions (Phase 12 locked decision §E). DRAFT can
 * move to CONFIRMED or CANCELLED; CONFIRMED and CANCELLED are terminal.
 * Every other transition (including CONFIRMED -> CANCELLED, CONFIRMED ->
 * DRAFT, CANCELLED -> anything) is rejected with 409, mirroring Phase 07's
 * "deletion blocked while children exist" business-rule-violation
 * precedent.
 */
const ALLOWED_TRANSITIONS: Record<SaleStatus, SaleStatus[]> = {
  [SaleStatus.Draft]: [SaleStatus.Confirmed, SaleStatus.Cancelled],
  [SaleStatus.Confirmed]: [],
  [SaleStatus.Cancelled]: [],
};

/**
 * Sales domain service (Phase 12, locked decisions). Sale creation is a
 * single TransactionService.run() call that: resolves/validates company,
 * customer, branch/warehouse, SalesAccount; locks and increments the
 * per-company/year sale counter with SELECT ... FOR UPDATE; resolves each
 * line's ProductVariant + currently-active PriceListItem server-side; and
 * computes every monetary total server-side, never trusting client-supplied
 * figures. All manager.create()/manager.save() calls inside run() use the
 * transactional EntityManager passed into the callback — never an injected
 * Repository, which would silently escape the transaction.
 */
@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
    private readonly transactionService: TransactionService,
    private readonly companiesService: CompaniesService,
    private readonly branchesService: BranchesService,
    private readonly warehousesService: WarehousesService,
    private readonly customersService: CustomersService,
    private readonly productVariantsService: ProductVariantsService,
    private readonly salesAccountAccessService: SalesAccountAccessService,
    private readonly loyaltyService: LoyaltyService,
    private readonly promotionsService: PromotionsService,
  ) {}

  async findAll(
    companyId: string,
    query: ListSalesDto,
  ): Promise<PaginatedSales> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const sortField = resolveSortField(
      query.sort,
      SORTABLE_FIELDS,
      'createdAt',
    );

    const qb = this.saleRepository
      .createQueryBuilder('sale')
      .where('sale.companyId = :companyId', { companyId });

    if (query.branchId) {
      qb.andWhere('sale.branchId = :branchId', { branchId: query.branchId });
    }
    if (query.warehouseId) {
      qb.andWhere('sale.warehouseId = :warehouseId', {
        warehouseId: query.warehouseId,
      });
    }
    if (query.customerId) {
      qb.andWhere('sale.customerId = :customerId', {
        customerId: query.customerId,
      });
    }
    if (query.salesAccountId) {
      qb.andWhere('sale.salesAccountId = :salesAccountId', {
        salesAccountId: query.salesAccountId,
      });
    }
    if (query.status) {
      qb.andWhere('sale.status = :status', { status: query.status });
    }
    if (query.saleType) {
      qb.andWhere('sale.saleType = :saleType', { saleType: query.saleType });
    }
    if (query.search) {
      qb.andWhere('sale.saleNumber LIKE :search', {
        search: `%${query.search}%`,
      });
    }

    qb.orderBy(`sale.${sortField}`, query.order ?? 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { page, limit, total } };
  }

  async findByIdInCompany(id: string, companyId: string): Promise<Sale> {
    const sale = await this.saleRepository.findOne({
      where: { id, companyId },
      relations: { items: true },
    });
    if (!sale) {
      throw new AppException(ErrorCode.NotFound, 'Sale not found');
    }
    return sale;
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
   * Customer must exist, be non-deleted, and belong to the resolved
   * company (Phase 12 §Customer validation, LOCKED) — a cross-company or
   * nonexistent customer id is 404, matching Phase 11's own IDOR-hiding
   * convention (CustomersService.findByIdInCompany already implements
   * this exact behavior; reused verbatim, not re-derived).
   */
  private async assertValidCustomer(
    customerId: string,
    companyId: string,
  ): Promise<void> {
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
  }

  /**
   * SalesAccount attribution is transaction-level only (Phase 12 locked
   * decision §A). When supplied: the SalesAccount must exist and belong to
   * the resolved company (cross-company/nonexistent -> 404, matching the
   * Customer/Product IDOR-hiding convention used throughout this codebase
   * since Phase 09), and the requesting user must be authorized to operate
   * it per SalesAccountAccessService.canAccessSalesAccount() — the ONLY
   * SalesAccount authorization mechanism used (unauthorized-but-existing
   * -> 403, a real permission distinct from "doesn't exist"). No second
   * mechanism, no DataScopeService.ACCOUNT resolution, no permanent
   * Customer<->SalesAccount assignment table.
   */
  private async assertValidSalesAccount(
    salesAccountId: string,
    companyId: string,
    userId: string,
    manager: EntityManager,
  ): Promise<void> {
    const salesAccount = await manager.findOne(SalesAccount, {
      where: { id: salesAccountId },
    });
    if (!salesAccount || salesAccount.companyId !== companyId) {
      throw new AppException(ErrorCode.NotFound, 'Sales account not found');
    }
    if (salesAccount.status !== SalesAccountStatus.Active) {
      throw new AppException(
        ErrorCode.ValidationError,
        'salesAccountId must reference an active sales account',
      );
    }
    const canAccess =
      await this.salesAccountAccessService.canAccessSalesAccount(
        userId,
        salesAccountId,
      );
    if (!canAccess) {
      throw new AppException(
        ErrorCode.Forbidden,
        'You are not authorized to attribute sales to this sales account',
      );
    }
  }

  /**
   * Resolves the single company PriceList to use for pricing resolution
   * when the client does not specify one on a line item. PriceList has no
   * "default/active" flag in the Phase 10 data model, so the rule is: if
   * the company has exactly one ACTIVE PriceList, use it; otherwise the
   * client must specify priceListId per item (ambiguity is rejected, never
   * silently guessed). See docs/SALES_ARCHITECTURE.md "Pricing Snapshot".
   */
  private async resolveDefaultPriceListId(
    companyId: string,
    manager: EntityManager,
  ): Promise<string | null> {
    const activeLists = await manager.find(PriceList, {
      where: { companyId, status: PriceListStatus.Active },
    });
    if (activeLists.length === 1) {
      return activeLists[0].id;
    }
    return null;
  }

  private async resolvePriceListId(
    itemDto: CreateSaleItemDto,
    companyId: string,
    defaultPriceListId: string | null,
    manager: EntityManager,
  ): Promise<string> {
    if (itemDto.priceListId) {
      const priceList = await manager.findOne(PriceList, {
        where: { id: itemDto.priceListId },
      });
      if (!priceList || priceList.companyId !== companyId) {
        throw new AppException(
          ErrorCode.ValidationError,
          'priceListId does not reference a price list in the resolved company',
        );
      }
      if (priceList.status !== PriceListStatus.Active) {
        throw new AppException(
          ErrorCode.ValidationError,
          'priceListId must reference an active price list',
        );
      }
      return priceList.id;
    }

    if (defaultPriceListId) {
      return defaultPriceListId;
    }

    throw new AppException(
      ErrorCode.ValidationError,
      'priceListId is required for this item: the company has zero or multiple active price lists',
    );
  }

  /**
   * Resolves the currently-active price for a (priceList, productVariant)
   * pair using the same validFrom <= now() AND (validTo IS NULL OR validTo
   * > now()) window PriceListItemsService's overlap logic implies (Phase
   * 10). No price-priority engine — a single point-in-time query against
   * the one resolved PriceList.
   */
  private async resolveActivePrice(
    priceListId: string,
    productVariantId: string,
    manager: EntityManager,
  ): Promise<string> {
    const now = new Date();
    const item = await manager.findOne(PriceListItem, {
      where: [
        {
          priceListId,
          productVariantId,
          status: PriceListItemStatus.Active,
          validFrom: LessThanOrEqual(now),
          validTo: IsNull(),
        },
        {
          priceListId,
          productVariantId,
          status: PriceListItemStatus.Active,
          validFrom: LessThanOrEqual(now),
          validTo: MoreThan(now),
        },
      ],
      order: { validFrom: 'DESC' },
    });

    if (!item) {
      throw new AppException(
        ErrorCode.ValidationError,
        `No active price found for product variant ${productVariantId} in the resolved price list`,
      );
    }

    return item.price;
  }

  /**
   * Locks (SELECT ... FOR UPDATE) and increments the company's per-year
   * sale-number counter inside the caller's transaction, then formats and
   * returns the new sale number (Phase 12 locked decision §F). Never uses
   * SELECT MAX(sale_number) + 1.
   *
   * The counter row for a given (company, year) is guaranteed to exist
   * before it is locked, via `INSERT ... ON DUPLICATE KEY UPDATE
   * last_sequence = last_sequence` (a no-op update that still lets MySQL's
   * InnoDB take the row lock atomically on first-ever use) — this avoids
   * the race a plain "SELECT FOR UPDATE, and if missing INSERT" sequence
   * would have: two concurrent transactions both observing "no row yet"
   * and both attempting to INSERT, where one would hit the unique
   * (company_id, year) constraint and fail instead of safely retrying.
   * The upsert makes row creation itself atomic and lock-compatible.
   */
  private async generateSaleNumber(
    companyId: string,
    year: number,
    manager: EntityManager,
  ): Promise<string> {
    await manager.query(
      'INSERT INTO `company_sale_counters` (`id`, `company_id`, `year`, `last_sequence`) ' +
        'VALUES (UUID(), ?, ?, 0) ' +
        'ON DUPLICATE KEY UPDATE `last_sequence` = `last_sequence`',
      [companyId, year],
    );

    const counter = await manager
      .createQueryBuilder(CompanySaleCounter, 'counter')
      .where('counter.companyId = :companyId', { companyId })
      .andWhere('counter.year = :year', { year })
      .setLock('pessimistic_write')
      .getOneOrFail();

    counter.lastSequence += 1;
    await manager.save(CompanySaleCounter, counter);
    return formatSaleNumber(year, counter.lastSequence);
  }

  /**
   * Creates a Sale together with all of its SaleItems inside a single
   * TransactionService.run() call (Phase 12 §Transaction, LOCKED). Any
   * failure at any step rolls back everything — no partial Sale/SaleItem
   * rows can ever exist. Client-submitted price/discount/tax/subtotal/
   * grandTotal figures are never used for unitPriceSnapshot/subtotal —
   * only the per-line discountAmount/taxAmount pass-through values are
   * accepted, and even those are validated non-negative before use.
   */
  async create(
    companyId: string,
    userId: string,
    dto: CreateSaleDto,
  ): Promise<Sale> {
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
    await this.assertValidCustomer(dto.customerId, companyId);

    // ProductVariant existence/company-scope is validated up front (before
    // the transaction) so a bad variant id fails fast with the same
    // findByIdInCompany 404 convention Phase 10 already established;
    // pricing resolution itself still happens inside the transaction
    // against the live PriceListItem rows.
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
      if (dto.salesAccountId) {
        await this.assertValidSalesAccount(
          dto.salesAccountId,
          companyId,
          userId,
          manager,
        );
      }

      const saleNumber = await this.generateSaleNumber(
        companyId,
        year,
        manager,
      );

      const defaultPriceListId = await this.resolveDefaultPriceListId(
        companyId,
        manager,
      );

      let subtotal = 0;
      let discountTotal = 0;
      let taxTotal = 0;
      const itemRows: Array<{
        productVariantId: string;
        quantity: number;
        unitPriceSnapshot: string;
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

        const priceListId = await this.resolvePriceListId(
          itemDto,
          companyId,
          defaultPriceListId,
          manager,
        );
        const unitPrice = await this.resolveActivePrice(
          priceListId,
          itemDto.productVariantId,
          manager,
        );

        const discount = Number(itemDto.discountAmount ?? '0');
        const tax = Number(itemDto.taxAmount ?? '0');
        if (discount < 0 || tax < 0) {
          throw new AppException(
            ErrorCode.ValidationError,
            'discountAmount and taxAmount must be non-negative',
          );
        }

        const lineSubtotal = Number(unitPrice) * itemDto.quantity;
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
          quantity: itemDto.quantity,
          unitPriceSnapshot: unitPrice,
          discountSnapshot: discount.toFixed(2),
          taxSnapshot: tax.toFixed(2),
          lineTotal: lineTotal.toFixed(2),
          productNameSnapshot: variant.product.name,
          skuSnapshot: variant.sku,
        });
      }

      // Order-level Promotion (Returns/Discounts/Loyalty phase, additive):
      // resolved and locked inside this same transaction, backend-computed
      // discount amount only — never a client-supplied total. Applied on
      // top of the sum of per-item discounts already computed above.
      let promotionId: string | null = null;
      if (dto.promotionCode) {
        const promotion = await this.promotionsService.resolveAndLockForUse(
          manager,
          companyId,
          dto.promotionCode,
          subtotal,
          transactionDate,
        );
        const promotionDiscount = this.promotionsService.computeDiscountAmount(
          promotion,
          subtotal - discountTotal,
        );
        discountTotal += promotionDiscount;
        promotionId = promotion.id;
      }

      const grandTotal = subtotal - discountTotal + taxTotal;

      const sale = manager.create(Sale, {
        saleNumber,
        saleType: dto.saleType ?? SaleType.Retail,
        customerId: dto.customerId,
        salesAccountId: dto.salesAccountId ?? null,
        companyId,
        branchId: dto.branchId ?? null,
        warehouseId: dto.warehouseId ?? null,
        transactionDate,
        status: SaleStatus.Draft,
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
      const savedSale = await manager.save(Sale, sale);

      if (promotionId) {
        await this.promotionsService.incrementUsage(manager, promotionId);
      }

      for (const row of itemRows) {
        const saleItem = manager.create(SaleItem, {
          saleId: savedSale.id,
          ...row,
        });
        await manager.save(SaleItem, saleItem);
      }

      savedSale.items = await manager.find(SaleItem, {
        where: { saleId: savedSale.id },
      });
      return savedSale;
    });
  }

  private assertTransitionAllowed(
    current: SaleStatus,
    target: SaleStatus,
  ): void {
    const allowed = ALLOWED_TRANSITIONS[current] ?? [];
    if (!allowed.includes(target)) {
      throw new AppException(
        ErrorCode.Conflict,
        `Cannot transition sale from ${current} to ${target}`,
      );
    }
  }

  /**
   * DRAFT -> CONFIRMED only (Phase 12 locked decision §E), extended by
   * Phase 14 (locked decision D5) to deduct real warehouse stock as part
   * of confirmation. Wrapped in TransactionService.run(): locks the
   * relevant WarehouseStock rows in deterministic (productVariantId) order
   * (upsert-then-lock, the same pattern GoodsReceipt/StockTransfer use),
   * validates sufficient onHandQuantity for every SaleItem under the
   * strict no-negative-stock policy (D7 — if ANY item is insufficient the
   * whole transaction rolls back, Sale stays DRAFT, 409), decreases stock,
   * writes one StockMovement(SALE_ISSUE) row per item, and only then flips
   * status and saves. See docs/INVENTORY_ARCHITECTURE.md "Sales
   * Integration" for the full cross-phase-boundary rationale.
   *
   * Discovered edge case (documented, resolved conservatively): Sale.
   * warehouseId is nullable at the document level (Phase 12's own design).
   * Since the locked Phase 14 spec unconditionally states that Sale
   * confirmation deducts stock with no carve-out, a Sale with no
   * warehouseId now cannot be confirmed at all — confirmation requires a
   * resolved warehouse to issue stock from. This is an additive tightening
   * of Sale's existing confirm() contract, not a new architectural
   * conflict; existing Phase 12 tests that confirmed a Sale without a
   * warehouseId were updated to supply one (see sales.service.spec.ts /
   * test/sales.e2e-spec.ts).
   */
  async confirm(id: string, companyId: string, userId: string): Promise<Sale> {
    const sale = await this.findByIdInCompany(id, companyId);
    this.assertTransitionAllowed(sale.status, SaleStatus.Confirmed);

    if (!sale.warehouseId) {
      throw new AppException(
        ErrorCode.ValidationError,
        'Sale.warehouseId is required to confirm a sale (stock must be issued from a specific warehouse)',
      );
    }
    const warehouseId = sale.warehouseId;
    const items = sale.items ?? [];

    return this.transactionService.run(async (manager) => {
      // Deterministic lock order (sort by productVariantId) — the same
      // upsert-then-SELECT...FOR UPDATE pattern GoodsReceipt/StockTransfer
      // use, applied here to every distinct variant referenced by this
      // Sale's items.
      const sortedItems = [...items].sort((a, b) =>
        a.productVariantId.localeCompare(b.productVariantId),
      );

      const lockedStocks = new Map<string, WarehouseStock>();
      for (const item of sortedItems) {
        if (lockedStocks.has(item.productVariantId)) {
          continue;
        }
        const stock = await lockWarehouseStockRow(
          manager,
          warehouseId,
          item.productVariantId,
        );
        lockedStocks.set(item.productVariantId, stock);
      }

      // Validate sufficient stock for EVERY item before mutating ANY of
      // them — all-or-nothing, no partial deduction (D7, LOCKED).
      for (const item of sortedItems) {
        const stock = lockedStocks.get(item.productVariantId)!;
        if (stock.onHandQuantity < item.quantity) {
          throw new AppException(
            ErrorCode.Conflict,
            `Insufficient stock for product variant ${item.productVariantId}: requested ${item.quantity}, available ${stock.onHandQuantity}`,
          );
        }
      }

      // Decrease stock and write a SALE_ISSUE movement per item.
      for (const item of sortedItems) {
        const stock = lockedStocks.get(item.productVariantId)!;
        stock.onHandQuantity -= item.quantity;
        // manager.update() rather than manager.save() — an entity
        // hydrated via createQueryBuilder().setLock().getOneOrFail()
        // (as lockWarehouseStockRow() returns) was found, via a real
        // e2e concurrency test in Phase 14's own GoodsReceipt flow, to
        // sometimes make manager.save() issue a duplicate INSERT instead
        // of an UPDATE. update() is unambiguous.
        await manager.update(WarehouseStock, stock.id, {
          onHandQuantity: stock.onHandQuantity,
        });

        const movement = manager.create(StockMovement, {
          warehouseId,
          productVariantId: item.productVariantId,
          movementType: StockMovementType.SaleIssue,
          quantityChange: -item.quantity,
          quantityAfter: stock.onHandQuantity,
          referenceType: StockMovementReferenceType.Sale,
          referenceId: sale.id,
          createdBy: userId,
        });
        await manager.save(StockMovement, movement);
      }

      sale.status = SaleStatus.Confirmed;
      sale.updatedBy = userId;
      const confirmedSale = await manager.save(Sale, sale);

      // Loyalty earning (Returns/Discounts/Loyalty phase, additive):
      // idempotent via LoyaltyPointTransaction's own
      // UNIQUE(company_id, source_type, source_id) — a retried/replayed
      // confirm() call (this method itself is only reachable once per
      // Sale, since a second call fails assertTransitionAllowed() before
      // reaching here, but a future caller reusing earnForSale() directly
      // is still protected). No-ops (returns null, no row written) if no
      // active LoyaltyProgram is configured for the company — loyalty is
      // opt-in configuration, never assumed.
      await this.loyaltyService.earnForSale(
        manager,
        confirmedSale.companyId,
        confirmedSale.customerId,
        confirmedSale.id,
        confirmedSale.grandTotal,
        userId,
      );

      return confirmedSale;
    });
  }

  /** DRAFT -> CANCELLED only (Phase 12 locked decision §E). */
  async cancel(id: string, companyId: string, userId: string): Promise<Sale> {
    const sale = await this.findByIdInCompany(id, companyId);
    this.assertTransitionAllowed(sale.status, SaleStatus.Cancelled);
    sale.status = SaleStatus.Cancelled;
    sale.updatedBy = userId;
    return this.saleRepository.save(sale);
  }

  /**
   * Phase 16 (Payment) integration point — D16, EXPLICITLY AUTHORIZED
   * cross-phase addition. Applies a newly-allocated payment amount to this
   * Sale's paidAmount/balanceAmount, participating in the CALLER's
   * transaction (never opens its own) so PaymentsService can create the
   * Payment/PaymentAllocation rows and update every target document's
   * balance atomically in one commit.
   *
   * The caller is responsible for locking the Sale row (SELECT ... FOR
   * UPDATE) BEFORE calling this method, in the deterministic
   * (referenceType, referenceId) order PaymentsService establishes across
   * every target document in a single payment — this method itself only
   * re-reads the already-locked row's current paidAmount/grandTotal inside
   * the same lock scope and writes the new values via manager.update(),
   * never manager.save() (the exact bug class Phase 14 found and fixed:
   * save() on an entity hydrated via
   * createQueryBuilder().setLock().getOneOrFail() was found, via a real
   * e2e concurrency test, to sometimes issue a duplicate INSERT instead of
   * an UPDATE — see confirm()'s own comment above for the original
   * discovery). Over-allocation (new paidAmount > grandTotal) is rejected
   * with a 409 Conflict, rolling back the caller's entire transaction — no
   * partial balance update is ever persisted.
   *
   * This method does not itself lock the row — see
   * PaymentsService.lockTargetDocuments() for the deterministic
   * cross-document lock-ordering step this method is deliberately kept
   * independent of, so SalesService never needs to know about
   * PurchaseOrder or vice versa.
   */
  async applyPayment(
    id: string,
    companyId: string,
    allocatedAmount: number,
    userId: string,
    manager: EntityManager,
  ): Promise<void> {
    const sale = await manager
      .createQueryBuilder(Sale, 'sale')
      .where('sale.id = :id', { id })
      .andWhere('sale.companyId = :companyId', { companyId })
      .setLock('pessimistic_write')
      .getOne();

    if (!sale) {
      throw new AppException(ErrorCode.NotFound, 'Sale not found');
    }

    const currentPaid = Number(sale.paidAmount);
    const grandTotal = Number(sale.grandTotal);
    const newPaid = currentPaid + allocatedAmount;

    if (newPaid > grandTotal + 1e-9) {
      throw new AppException(
        ErrorCode.Conflict,
        `Allocating ${allocatedAmount.toFixed(2)} to sale ${id} would exceed its grand total (already paid ${currentPaid.toFixed(2)} of ${grandTotal.toFixed(2)})`,
      );
    }

    const newBalance = grandTotal - newPaid;

    await manager.update(Sale, sale.id, {
      paidAmount: newPaid.toFixed(2),
      balanceAmount: newBalance.toFixed(2),
      updatedBy: userId,
    });
  }
}
