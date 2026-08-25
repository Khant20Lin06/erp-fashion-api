import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WarehouseStock } from '../../inventory/entities/warehouse-stock.entity';
import { StockMovement } from '../../inventory/entities/stock-movement.entity';
import { SaleItem } from '../../sales/entities/sale-item.entity';
import { SaleStatus } from '../../sales/entities/sale-status.enum';
import {
  InventoryMovementQueryDto,
  InventoryStockSummaryQueryDto,
  SlowMovingStockQueryDto,
} from '../dto/inventory-report-query.dto';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';

export interface StockSummaryRow {
  warehouseId: string;
  warehouseName: string;
  productVariantId: string;
  sku: string;
  onHandQuantity: number;
  reservedQuantity: number;
}

export interface MovementRow {
  id: string;
  warehouseId: string;
  warehouseName: string;
  productVariantId: string;
  sku: string;
  movementType: string;
  quantityChange: number;
  quantityAfter: number;
  referenceType: string;
  referenceId: string;
  createdAt: Date;
}

export interface PaginatedMovements {
  data: MovementRow[];
  meta: { page: number; limit: number; total: number };
}

export interface SlowMovingStockRow {
  warehouseId: string;
  warehouseName: string;
  productVariantId: string;
  sku: string;
  productName: string;
  onHandQuantity: number;
  /** Real SUM(SaleItem.quantity) across CONFIRMED sales within
   * [fromDate, toDate] for this exact variant — 0 (not null) when the
   * variant sold zero units in the window, since "never sold" is the
   * strongest slow-moving signal, not a missing value. */
  unitsSoldInPeriod: number;
  sellingPrice: string;
}

const DEFAULT_SLOW_MOVING_WINDOW_DAYS = 30;
const MAX_SLOW_MOVING_ROWS = 25;

/**
 * New Phase 22 report — Inventory (stock summary/movement), quantity-only,
 * from real WarehouseStock/StockMovement data (Phase 14). NO valuation/COGS
 * — explicitly out of scope (no cost column exists on either source table;
 * see the phase's own locked-scope statement). company scoping is via a
 * join to Warehouse (WarehouseStock/StockMovement carry warehouseId only,
 * not companyId directly — Warehouse.companyId is the real, denormalized
 * tenancy column, per Warehouse's own entity docblock).
 */
@Injectable()
export class InventoryReportsService {
  constructor(
    @InjectRepository(WarehouseStock)
    private readonly warehouseStockRepository: Repository<WarehouseStock>,
    @InjectRepository(StockMovement)
    private readonly stockMovementRepository: Repository<StockMovement>,
    @InjectRepository(SaleItem)
    private readonly saleItemRepository: Repository<SaleItem>,
  ) {}

  async stockSummary(
    companyId: string,
    query: InventoryStockSummaryQueryDto & {
      allowedBranchIds?: string[] | null;
    },
  ): Promise<StockSummaryRow[]> {
    const qb = this.warehouseStockRepository
      .createQueryBuilder('stock')
      .innerJoin('stock.warehouse', 'warehouse')
      .innerJoin('stock.productVariant', 'variant')
      .where('warehouse.companyId = :companyId', { companyId });

    if (query.warehouseId) {
      qb.andWhere('stock.warehouseId = :warehouseId', {
        warehouseId: query.warehouseId,
      });
    }
    if (query.branchId) {
      qb.andWhere('warehouse.branchId = :branchId', {
        branchId: query.branchId,
      });
    } else if (query.allowedBranchIds?.length) {
      qb.andWhere('warehouse.branchId IN (:...allowedBranchIds)', {
        allowedBranchIds: query.allowedBranchIds,
      });
    }

    qb.select([
      'warehouse.id AS warehouseId',
      'warehouse.name AS warehouseName',
      'variant.id AS productVariantId',
      'variant.sku AS sku',
      'stock.onHandQuantity AS onHandQuantity',
      'stock.reservedQuantity AS reservedQuantity',
    ])
      .orderBy('warehouse.name', 'ASC')
      .addOrderBy('variant.sku', 'ASC');

    const rows = await qb.getRawMany<{
      warehouseId: string;
      warehouseName: string;
      productVariantId: string;
      sku: string;
      onHandQuantity: string | number;
      reservedQuantity: string | number;
    }>();

    return rows.map((row) => ({
      warehouseId: row.warehouseId,
      warehouseName: row.warehouseName,
      productVariantId: row.productVariantId,
      sku: row.sku,
      onHandQuantity: Number(row.onHandQuantity),
      reservedQuantity: Number(row.reservedQuantity),
    }));
  }

  /**
   * In-stock variants ranked by how few units sold in a recent window —
   * the real signal a promotion/discount decision needs, as opposed to
   * TopProductsTool's inverse concept (SalesReportsService.byProduct(),
   * which INNER JOINs sale.items and groups by productNameSnapshot text,
   * so a variant with ZERO sales never appears there at all — exactly the
   * variants a discount decision cares most about). Built as its own
   * query rather than reusing byProduct() with a different sort, since
   * "in stock but never sold" requires starting from WarehouseStock and
   * LEFT JOINing sales activity, not starting from sales and having
   * nothing to join FROM for a product that was never sold.
   *
   * onHandQuantity > 0 only — an out-of-stock variant isn't a discount
   * candidate regardless of how slowly it sold. sellingPrice is included
   * so the LLM (or a human) has a real number to reason a discount
   * percentage against, never inventing one.
   */
  async slowMoving(
    companyId: string,
    query: SlowMovingStockQueryDto & { allowedBranchIds?: string[] | null },
  ): Promise<SlowMovingStockRow[]> {
    const toDate = query.toDate ?? new Date().toISOString().slice(0, 10);
    const fromDate =
      query.fromDate ??
      new Date(
        new Date(toDate).getTime() -
          DEFAULT_SLOW_MOVING_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      )
        .toISOString()
        .slice(0, 10);

    const qb = this.warehouseStockRepository
      .createQueryBuilder('stock')
      .innerJoin('stock.warehouse', 'warehouse')
      .innerJoin('stock.productVariant', 'variant')
      .innerJoin('variant.product', 'product')
      .leftJoin(
        (subQuery) =>
          subQuery
            .select('item.product_variant_id', 'productVariantId')
            .addSelect('SUM(item.quantity)', 'unitsSold')
            .from(SaleItem, 'item')
            .innerJoin('item.sale', 'sale')
            .where('sale.status = :status', { status: SaleStatus.Confirmed })
            .andWhere('sale.transactionDate >= :fromDate', { fromDate })
            .andWhere('sale.transactionDate <= :toDate', { toDate })
            .groupBy('item.product_variant_id'),
        'salesInPeriod',
        'salesInPeriod.productVariantId = variant.id',
      )
      .where('warehouse.companyId = :companyId', { companyId })
      .andWhere('stock.onHandQuantity > 0');

    if (query.warehouseId) {
      qb.andWhere('stock.warehouseId = :warehouseId', {
        warehouseId: query.warehouseId,
      });
    }
    if (query.branchId) {
      qb.andWhere('warehouse.branchId = :branchId', {
        branchId: query.branchId,
      });
    } else if (query.allowedBranchIds?.length) {
      qb.andWhere('warehouse.branchId IN (:...allowedBranchIds)', {
        allowedBranchIds: query.allowedBranchIds,
      });
    }

    qb.select([
      'warehouse.id AS warehouseId',
      'warehouse.name AS warehouseName',
      'variant.id AS productVariantId',
      'variant.sku AS sku',
      'product.name AS productName',
      'stock.onHandQuantity AS onHandQuantity',
      'variant.sellingPrice AS sellingPrice',
    ])
      .addSelect('COALESCE(salesInPeriod.unitsSold, 0)', 'unitsSoldInPeriod')
      .orderBy('unitsSoldInPeriod', 'ASC')
      .addOrderBy('stock.onHandQuantity', 'DESC')
      .limit(MAX_SLOW_MOVING_ROWS);

    const rows = await qb.getRawMany<{
      warehouseId: string;
      warehouseName: string;
      productVariantId: string;
      sku: string;
      productName: string;
      onHandQuantity: string | number;
      sellingPrice: string;
      unitsSoldInPeriod: string | number;
    }>();

    return rows.map((row) => ({
      warehouseId: row.warehouseId,
      warehouseName: row.warehouseName,
      productVariantId: row.productVariantId,
      sku: row.sku,
      productName: row.productName,
      onHandQuantity: Number(row.onHandQuantity),
      unitsSoldInPeriod: Number(row.unitsSoldInPeriod),
      sellingPrice: row.sellingPrice,
    }));
  }

  async movements(
    companyId: string,
    query: InventoryMovementQueryDto & { allowedBranchIds?: string[] | null },
  ): Promise<PaginatedMovements> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;

    const qb = this.stockMovementRepository
      .createQueryBuilder('movement')
      .innerJoin('movement.warehouse', 'warehouse')
      .innerJoin('movement.productVariant', 'variant')
      .where('warehouse.companyId = :companyId', { companyId });

    if (query.warehouseId) {
      qb.andWhere('movement.warehouseId = :warehouseId', {
        warehouseId: query.warehouseId,
      });
    }
    if (query.branchId) {
      qb.andWhere('warehouse.branchId = :branchId', {
        branchId: query.branchId,
      });
    } else if (query.allowedBranchIds?.length) {
      qb.andWhere('warehouse.branchId IN (:...allowedBranchIds)', {
        allowedBranchIds: query.allowedBranchIds,
      });
    }
    if (query.productVariantId) {
      qb.andWhere('movement.productVariantId = :productVariantId', {
        productVariantId: query.productVariantId,
      });
    }

    qb.select([
      'movement.id AS id',
      'warehouse.id AS warehouseId',
      'warehouse.name AS warehouseName',
      'variant.id AS productVariantId',
      'variant.sku AS sku',
      'movement.movementType AS movementType',
      'movement.quantityChange AS quantityChange',
      'movement.quantityAfter AS quantityAfter',
      'movement.referenceType AS referenceType',
      'movement.referenceId AS referenceId',
      'movement.createdAt AS createdAt',
    ])
      .orderBy('movement.createdAt', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit);

    const countQb = this.stockMovementRepository
      .createQueryBuilder('movement')
      .innerJoin('movement.warehouse', 'warehouse')
      .where('warehouse.companyId = :companyId', { companyId });
    if (query.warehouseId) {
      countQb.andWhere('movement.warehouseId = :warehouseId', {
        warehouseId: query.warehouseId,
      });
    }
    if (query.branchId) {
      countQb.andWhere('warehouse.branchId = :branchId', {
        branchId: query.branchId,
      });
    } else if (query.allowedBranchIds?.length) {
      countQb.andWhere('warehouse.branchId IN (:...allowedBranchIds)', {
        allowedBranchIds: query.allowedBranchIds,
      });
    }
    if (query.productVariantId) {
      countQb.andWhere('movement.productVariantId = :productVariantId', {
        productVariantId: query.productVariantId,
      });
    }

    const [rows, total] = await Promise.all([
      qb.getRawMany<{
        id: string;
        warehouseId: string;
        warehouseName: string;
        productVariantId: string;
        sku: string;
        movementType: string;
        quantityChange: number;
        quantityAfter: number;
        referenceType: string;
        referenceId: string;
        createdAt: Date;
      }>(),
      countQb.getCount(),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        warehouseId: row.warehouseId,
        warehouseName: row.warehouseName,
        productVariantId: row.productVariantId,
        sku: row.sku,
        movementType: row.movementType,
        quantityChange: Number(row.quantityChange),
        quantityAfter: Number(row.quantityAfter),
        referenceType: row.referenceType,
        referenceId: row.referenceId,
        createdAt: row.createdAt,
      })),
      meta: { page, limit, total },
    };
  }
}
