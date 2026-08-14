import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockMovement } from '../entities/stock-movement.entity';
import { WarehouseStock } from '../entities/warehouse-stock.entity';
import { ListInventoryLedgerDto } from '../dto/list-inventory-ledger.dto';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { resolveSortField } from '../../../shared/dto/resolve-sort-field';

export interface PaginatedStockMovements {
  data: StockMovement[];
  meta: { page: number; limit: number; total: number };
}

export interface ReconciliationResult {
  warehouseId: string;
  productVariantId: string;
  warehouseStockBalance: number;
  ledgerBalance: number;
  difference: number;
  reconciled: boolean;
}

/**
 * Explicit, minimal allowlist for GET /inventory-ledger's `sort` query
 * param — resolveSortField() rejects anything not in this list (Phase 04
 * infrastructure, reused unmodified). Kept intentionally small and
 * justified: createdAt is the natural chronological axis, quantityChange
 * lets a caller find the largest single movements, movementType lets a
 * caller group same-type movements together. id is deliberately not
 * offered as a standalone sort field (it is only ever used as the
 * deterministic ASC tiebreak for the stock card, never as a user-facing
 * sort axis for the general list).
 */
const SORTABLE_FIELDS = [
  'createdAt',
  'quantityChange',
  'movementType',
] as const;

/**
 * Phase 15 — Inventory Ledger. Purely a read/query layer over the Phase 14
 * StockMovement append-only log and WarehouseStock balance table — neither
 * entity is written, mutated, or migrated by this service. See
 * docs/INVENTORY_ARCHITECTURE.md §3/§14 for the explicit "Phase 14 writes,
 * Phase 15 queries" boundary statement this service fulfills.
 *
 * Company scoping is resolved by joining through warehouse.companyId,
 * exactly matching WarehouseStockService's own "derive scope through the
 * entity's real parent" pattern (StockMovement, like WarehouseStock, has no
 * companyId column of its own).
 */
@Injectable()
export class InventoryLedgerService {
  constructor(
    @InjectRepository(StockMovement)
    private readonly stockMovementRepository: Repository<StockMovement>,
    @InjectRepository(WarehouseStock)
    private readonly warehouseStockRepository: Repository<WarehouseStock>,
  ) {}

  /**
   * Rejects fromDate > toDate with a clear 400 — never silently swaps them
   * (Phase 15 locked validation rule).
   */
  private assertValidDateRange(fromDate?: string, toDate?: string): void {
    if (!fromDate || !toDate) {
      return;
    }
    if (new Date(fromDate).getTime() > new Date(toDate).getTime()) {
      throw new AppException(
        ErrorCode.ValidationError,
        'fromDate must not be after toDate',
      );
    }
  }

  async findAll(
    companyId: string,
    query: ListInventoryLedgerDto,
  ): Promise<PaginatedStockMovements> {
    this.assertValidDateRange(query.fromDate, query.toDate);

    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const sortField = resolveSortField(
      query.sort,
      SORTABLE_FIELDS,
      'createdAt',
    );

    const qb = this.stockMovementRepository
      .createQueryBuilder('movement')
      .innerJoin('movement.warehouse', 'warehouse')
      .where('warehouse.companyId = :companyId', { companyId });

    if (query.warehouseId) {
      qb.andWhere('movement.warehouseId = :warehouseId', {
        warehouseId: query.warehouseId,
      });
    }
    if (query.productVariantId) {
      qb.andWhere('movement.productVariantId = :productVariantId', {
        productVariantId: query.productVariantId,
      });
    }
    if (query.movementType) {
      qb.andWhere('movement.movementType = :movementType', {
        movementType: query.movementType,
      });
    }
    if (query.referenceType) {
      qb.andWhere('movement.referenceType = :referenceType', {
        referenceType: query.referenceType,
      });
    }
    if (query.referenceId) {
      qb.andWhere('movement.referenceId = :referenceId', {
        referenceId: query.referenceId,
      });
    }
    if (query.fromDate) {
      qb.andWhere('movement.createdAt >= :fromDate', {
        fromDate: query.fromDate,
      });
    }
    if (query.toDate) {
      qb.andWhere('movement.createdAt <= :toDate', { toDate: query.toDate });
    }

    qb.orderBy(`movement.${sortField}`, query.order ?? 'DESC')
      // Deterministic tiebreak — never rely on natural DB ordering alone,
      // matching the stock card's own ordering discipline below.
      .addOrderBy('movement.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { page, limit, total } };
  }

  /**
   * Company-scoped single-movement lookup — cross-company/nonexistent ids
   * are 404, matching the IDOR-hiding convention established since Phase
   * 09 (never 403, never a leaked existence signal).
   */
  async findByIdInCompany(
    id: string,
    companyId: string,
  ): Promise<StockMovement> {
    const movement = await this.stockMovementRepository
      .createQueryBuilder('movement')
      .innerJoin('movement.warehouse', 'warehouse')
      .where('movement.id = :id', { id })
      .andWhere('warehouse.companyId = :companyId', { companyId })
      .getOne();

    if (!movement) {
      throw new AppException(ErrorCode.NotFound, 'Stock movement not found');
    }
    return movement;
  }

  /**
   * Stock Card (Phase 15 locked scope C): every StockMovement for exactly
   * one (warehouseId, productVariantId) pair, in chronological order
   * (createdAt ASC, id ASC deterministic tiebreak — never natural DB
   * ordering). balanceBefore/balanceAfter are computed at the response-DTO
   * layer (toStockCardEntryResponseDto), not here — this method only
   * returns the raw, correctly-ordered StockMovement rows.
   */
  async getStockCard(
    companyId: string,
    warehouseId: string | undefined,
    productVariantId: string | undefined,
  ): Promise<StockMovement[]> {
    if (!warehouseId || !productVariantId) {
      throw new AppException(
        ErrorCode.ValidationError,
        'warehouseId and productVariantId are both required',
      );
    }

    return this.stockMovementRepository
      .createQueryBuilder('movement')
      .innerJoin('movement.warehouse', 'warehouse')
      .where('warehouse.companyId = :companyId', { companyId })
      .andWhere('movement.warehouseId = :warehouseId', { warehouseId })
      .andWhere('movement.productVariantId = :productVariantId', {
        productVariantId,
      })
      .orderBy('movement.createdAt', 'ASC')
      .addOrderBy('movement.id', 'ASC')
      .getMany();
  }

  /**
   * Reconciliation diagnostic (Phase 15 locked scope D): compares
   * SUM(StockMovement.quantityChange) against the live
   * WarehouseStock.onHandQuantity for one (warehouseId, productVariantId)
   * pair. Purely read-only — never writes anything, never "fixes" a
   * discrepancy, regardless of the result. A pair with no WarehouseStock
   * row yet (never touched by any Phase 14 write path) is treated as
   * balance 0, which is the same "row created lazily on first touch"
   * semantics WarehouseStockService itself already relies on.
   */
  async getReconciliation(
    companyId: string,
    warehouseId: string | undefined,
    productVariantId: string | undefined,
  ): Promise<ReconciliationResult> {
    if (!warehouseId || !productVariantId) {
      throw new AppException(
        ErrorCode.ValidationError,
        'warehouseId and productVariantId are both required',
      );
    }

    const sumRow = await this.stockMovementRepository
      .createQueryBuilder('movement')
      .innerJoin('movement.warehouse', 'warehouse')
      .select('COALESCE(SUM(movement.quantityChange), 0)', 'total')
      .where('warehouse.companyId = :companyId', { companyId })
      .andWhere('movement.warehouseId = :warehouseId', { warehouseId })
      .andWhere('movement.productVariantId = :productVariantId', {
        productVariantId,
      })
      .getRawOne<{ total: string }>();
    const ledgerBalance = Number(sumRow?.total ?? 0);

    const stockRow = await this.warehouseStockRepository
      .createQueryBuilder('stock')
      .innerJoin('stock.warehouse', 'warehouse')
      .where('warehouse.companyId = :companyId', { companyId })
      .andWhere('stock.warehouseId = :warehouseId', { warehouseId })
      .andWhere('stock.productVariantId = :productVariantId', {
        productVariantId,
      })
      .getOne();
    const warehouseStockBalance = stockRow?.onHandQuantity ?? 0;

    const difference = warehouseStockBalance - ledgerBalance;

    return {
      warehouseId,
      productVariantId,
      warehouseStockBalance,
      ledgerBalance,
      difference,
      reconciled: difference === 0,
    };
  }
}
