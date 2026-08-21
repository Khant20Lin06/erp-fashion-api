import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { EntityManager, In, Repository } from 'typeorm';
import { StockAdjustment } from '../entities/stock-adjustment.entity';
import { CompanyStockAdjustmentCounter } from '../entities/company-stock-adjustment-counter.entity';
import { WarehouseStock } from '../entities/warehouse-stock.entity';
import { StockMovement } from '../entities/stock-movement.entity';
import { StockMovementType } from '../entities/stock-movement-type.enum';
import { StockMovementReferenceType } from '../entities/stock-movement-reference-type.enum';
import { StockAdjustmentReason } from '../entities/stock-adjustment-reason.enum';
import { CreateStockAdjustmentDto } from '../dto/create-stock-adjustment.dto';
import { ListStockAdjustmentsDto } from '../dto/list-stock-adjustments.dto';
import { formatDocumentNumber } from '../utils/document-number';
import { lockWarehouseStockRow } from '../utils/stock-lock';
import { retryOnDuplicateEntry } from '../utils/upsert-retry';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { WarehousesService } from '../../organization/services/warehouses.service';
import { WarehouseStatus } from '../../organization/entities/warehouse-status.enum';
import { ProductVariantsService } from '../../products/services/product-variants.service';
import { ProductVariantStatus } from '../../products/entities/product-variant-status.enum';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import {
  StockAdjustmentResponseDto,
  toStockAdjustmentResponseDto,
} from '../dto/stock-adjustment-response.dto';
import { Warehouse } from '../../organization/entities/warehouse.entity';
import { ProductVariant } from '../../products/entities/product-variant.entity';
import { ProductVariantAttribute } from '../../products/entities/product-variant-attribute.entity';
import { User } from '../../users/entities/user.entity';

export interface PaginatedStockAdjustments {
  data: StockAdjustment[];
  meta: { page: number; limit: number; total: number };
}

export interface PaginatedStockAdjustmentViews {
  data: StockAdjustmentResponseDto[];
  meta: { page: number; limit: number; total: number };
}

/**
 * StockAdjustment domain service (Phase 14 locked decision D10/D11).
 * Single-line flat model — no StockAdjustmentItem. Creation immediately
 * mutates stock inside a single TransactionService.run() call: positive
 * quantityChange increases stock with no restriction; negative
 * quantityChange enforces strict no-negative-stock (D7) inside the same
 * row lock. Movement type written is OPENING_BALANCE when
 * reason === OPENING_BALANCE, else ADJUSTMENT.
 */
@Injectable()
export class StockAdjustmentsService {
  constructor(
    @InjectRepository(StockAdjustment)
    private readonly stockAdjustmentRepository: Repository<StockAdjustment>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(ProductVariant)
    private readonly productVariantRepository: Repository<ProductVariant>,
    @InjectRepository(ProductVariantAttribute)
    private readonly productVariantAttributeRepository: Repository<ProductVariantAttribute>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(StockMovement)
    private readonly stockMovementRepository: Repository<StockMovement>,
    private readonly transactionService: TransactionService,
    private readonly warehousesService: WarehousesService,
    private readonly productVariantsService: ProductVariantsService,
  ) {}

  async findAllView(
    companyId: string,
    query: ListStockAdjustmentsDto,
  ): Promise<PaginatedStockAdjustmentViews> {
    const result = await this.findAll(companyId, query);
    return {
      data: await this.enrichAdjustments(result.data),
      meta: result.meta,
    };
  }

  async findAll(
    companyId: string,
    query: ListStockAdjustmentsDto,
  ): Promise<PaginatedStockAdjustments> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;

    const qb = this.stockAdjustmentRepository
      .createQueryBuilder('sa')
      .where('sa.companyId = :companyId', { companyId });

    if (query.warehouseId) {
      qb.andWhere('sa.warehouseId = :warehouseId', {
        warehouseId: query.warehouseId,
      });
    }
    if (query.productVariantId) {
      qb.andWhere('sa.productVariantId = :productVariantId', {
        productVariantId: query.productVariantId,
      });
    }
    if (query.reason) {
      qb.andWhere('sa.reason = :reason', { reason: query.reason });
    }

    qb.orderBy('sa.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { page, limit, total } };
  }

  async findByIdInCompany(
    id: string,
    companyId: string,
  ): Promise<StockAdjustment> {
    const adjustment = await this.stockAdjustmentRepository.findOne({
      where: { id, companyId },
    });
    if (!adjustment) {
      throw new AppException(ErrorCode.NotFound, 'Stock adjustment not found');
    }
    return adjustment;
  }

  async findViewByIdInCompany(
    id: string,
    companyId: string,
  ): Promise<StockAdjustmentResponseDto> {
    const adjustment = await this.findByIdInCompany(id, companyId);
    const [view] = await this.enrichAdjustments([adjustment]);
    if (!view) {
      throw new AppException(ErrorCode.NotFound, 'Stock adjustment not found');
    }
    return view;
  }

  private async generateAdjustmentNumber(
    companyId: string,
    year: number,
    manager: EntityManager,
  ): Promise<string> {
    await retryOnDuplicateEntry(() =>
      manager.query(
        'INSERT INTO `company_stock_adjustment_counters` (`id`, `company_id`, `year`, `last_sequence`) ' +
          'VALUES (?, ?, ?, 0) ' +
          'ON DUPLICATE KEY UPDATE `last_sequence` = `last_sequence`',
        [randomUUID(), companyId, year],
      ),
    );

    const counter = await manager
      .createQueryBuilder(CompanyStockAdjustmentCounter, 'counter')
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
    await manager.update(CompanyStockAdjustmentCounter, counter.id, {
      lastSequence: nextSequence,
    });
    return formatDocumentNumber('ADJ', year, nextSequence);
  }

  async create(
    companyId: string,
    userId: string,
    dto: CreateStockAdjustmentDto,
  ): Promise<StockAdjustment> {
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

    const variant = await this.productVariantsService.findByIdInCompany(
      dto.productVariantId,
      companyId,
    );
    if (variant.status !== ProductVariantStatus.Active) {
      throw new AppException(
        ErrorCode.ValidationError,
        'productVariantId does not reference an active product variant',
      );
    }

    if (dto.quantityChange === 0) {
      throw new AppException(
        ErrorCode.ValidationError,
        'quantityChange must be nonzero',
      );
    }

    const year = new Date().getUTCFullYear();

    return this.transactionService.run(async (manager) => {
      const adjustmentNumber = await this.generateAdjustmentNumber(
        companyId,
        year,
        manager,
      );

      const stock = await lockWarehouseStockRow(
        manager,
        dto.warehouseId,
        dto.productVariantId,
      );

      const newQuantity = stock.onHandQuantity + dto.quantityChange;
      if (newQuantity < 0) {
        throw new AppException(
          ErrorCode.Conflict,
          'Adjustment would drive on-hand quantity below zero',
        );
      }

      // manager.update() rather than manager.save() — see
      // GoodsReceiptsService's comment for why.
      await manager.update(WarehouseStock, stock.id, {
        onHandQuantity: newQuantity,
      });
      stock.onHandQuantity = newQuantity;

      const adjustment = manager.create(StockAdjustment, {
        adjustmentNumber,
        warehouseId: dto.warehouseId,
        productVariantId: dto.productVariantId,
        quantityChange: dto.quantityChange,
        reason: dto.reason,
        companyId,
        notes: dto.notes ?? null,
        createdBy: userId,
      });
      const savedAdjustment = await manager.save(StockAdjustment, adjustment);

      const movement = manager.create(StockMovement, {
        warehouseId: dto.warehouseId,
        productVariantId: dto.productVariantId,
        movementType:
          dto.reason === StockAdjustmentReason.OpeningBalance
            ? StockMovementType.OpeningBalance
            : StockMovementType.Adjustment,
        quantityChange: dto.quantityChange,
        quantityAfter: newQuantity,
        referenceType: StockMovementReferenceType.StockAdjustment,
        referenceId: savedAdjustment.id,
        createdBy: userId,
      });
      await manager.save(StockMovement, movement);

      return savedAdjustment;
    });
  }

  async createView(
    companyId: string,
    userId: string,
    dto: CreateStockAdjustmentDto,
  ): Promise<StockAdjustmentResponseDto> {
    const adjustment = await this.create(companyId, userId, dto);
    const [view] = await this.enrichAdjustments([adjustment]);
    if (!view) {
      throw new AppException(
        ErrorCode.InternalError,
        'Failed to build stock adjustment response',
      );
    }
    return view;
  }

  private async enrichAdjustments(
    adjustments: StockAdjustment[],
  ): Promise<StockAdjustmentResponseDto[]> {
    if (adjustments.length === 0) {
      return [];
    }

    const unique = (values: string[]) => [...new Set(values)];

    const warehouseIds = unique(adjustments.map((adjustment) => adjustment.warehouseId));
    const productVariantIds = unique(
      adjustments.map((adjustment) => adjustment.productVariantId),
    );
    const userIds = unique(
      adjustments
        .map((adjustment) => adjustment.createdBy)
        .filter((value): value is string => Boolean(value)),
    );
    const adjustmentIds = adjustments.map((adjustment) => adjustment.id);

    const [
      warehouses,
      variants,
      variantAttributes,
      users,
      movements,
    ] = await Promise.all([
      this.warehouseRepository.find({ where: { id: In(warehouseIds) } }),
      this.productVariantRepository.find({
        where: { id: In(productVariantIds) },
        relations: { product: true },
      }),
      this.productVariantAttributeRepository.find({
        where: { variantId: In(productVariantIds) },
        relations: { option: true },
      }),
      userIds.length > 0
        ? this.userRepository.find({ where: { id: In(userIds) } })
        : Promise.resolve([]),
      this.stockMovementRepository.find({
        where: {
          referenceType: StockMovementReferenceType.StockAdjustment,
          referenceId: In(adjustmentIds),
        },
      }),
    ]);

    const warehouseNames = new Map(
      warehouses.map((warehouse) => [warehouse.id, warehouse.name]),
    );
    const variantsById = new Map(
      variants.map((variant) => [variant.id, variant]),
    );
    const usersById = new Map(users.map((user) => [user.id, user]));
    const movementsByReferenceId = new Map(
      movements.map((movement) => [movement.referenceId, movement]),
    );

    const variantLabels = new Map<string, string>();
    for (const variantId of productVariantIds) {
      const label = variantAttributes
        .filter((attribute) => attribute.variantId === variantId)
        .sort((a, b) => a.kind.localeCompare(b.kind))
        .map((attribute) => attribute.option.value.trim())
        .filter(Boolean)
        .join(' / ');

      if (label) {
        variantLabels.set(variantId, label);
      }
    }

    return adjustments.map((adjustment) => {
      const variant = variantsById.get(adjustment.productVariantId);
      const movement = movementsByReferenceId.get(adjustment.id);
      const createdByUser = adjustment.createdBy
        ? usersById.get(adjustment.createdBy)
        : undefined;

      return toStockAdjustmentResponseDto(adjustment, {
        warehouseName: warehouseNames.get(adjustment.warehouseId) ?? null,
        productName: variant?.product?.name ?? null,
        sku: variant?.sku ?? null,
        variantLabel: variantLabels.get(adjustment.productVariantId) ?? null,
        quantityAfter: movement?.quantityAfter ?? null,
        createdByName: createdByUser?.displayName ?? null,
      });
    });
  }
}
