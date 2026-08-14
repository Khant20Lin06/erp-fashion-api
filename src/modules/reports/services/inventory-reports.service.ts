import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WarehouseStock } from '../../inventory/entities/warehouse-stock.entity';
import { StockMovement } from '../../inventory/entities/stock-movement.entity';
import {
  InventoryMovementQueryDto,
  InventoryStockSummaryQueryDto,
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
