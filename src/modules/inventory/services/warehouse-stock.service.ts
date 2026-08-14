import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WarehouseStock } from '../entities/warehouse-stock.entity';
import { ListWarehouseStockDto } from '../dto/list-warehouse-stock.dto';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';

export interface PaginatedWarehouseStock {
  data: WarehouseStock[];
  meta: { page: number; limit: number; total: number };
}

/**
 * Read-only stock-balance query service (Phase 14 locked API surface — no
 * create/update/delete endpoint for WarehouseStock; every row is written
 * internally by GoodsReceipt/Sale-confirm/StockTransfer/StockAdjustment,
 * never directly). Company scoping is resolved by joining through
 * warehouse.companyId, since WarehouseStock itself carries no companyId
 * column (its identity is purely (warehouseId, productVariantId), per the
 * stock-identity contract in
 * docs/PRODUCT_VARIANT_PRICING_ARCHITECTURE.md §21).
 */
@Injectable()
export class WarehouseStockService {
  constructor(
    @InjectRepository(WarehouseStock)
    private readonly warehouseStockRepository: Repository<WarehouseStock>,
  ) {}

  async findAll(
    companyId: string,
    query: ListWarehouseStockDto,
  ): Promise<PaginatedWarehouseStock> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;

    const qb = this.warehouseStockRepository
      .createQueryBuilder('stock')
      .innerJoin('stock.warehouse', 'warehouse')
      .where('warehouse.companyId = :companyId', { companyId });

    if (query.warehouseId) {
      qb.andWhere('stock.warehouseId = :warehouseId', {
        warehouseId: query.warehouseId,
      });
    }
    if (query.productVariantId) {
      qb.andWhere('stock.productVariantId = :productVariantId', {
        productVariantId: query.productVariantId,
      });
    }

    qb.orderBy('stock.updatedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { page, limit, total } };
  }

  /**
   * Company-scoped lookup — cross-company/nonexistent ids are 404,
   * matching the IDOR-hiding convention established since Phase 09.
   */
  async findByIdInCompany(
    id: string,
    companyId: string,
  ): Promise<WarehouseStock> {
    const stock = await this.warehouseStockRepository
      .createQueryBuilder('stock')
      .innerJoin('stock.warehouse', 'warehouse')
      .where('stock.id = :id', { id })
      .andWhere('warehouse.companyId = :companyId', { companyId })
      .getOne();

    if (!stock) {
      throw new AppException(ErrorCode.NotFound, 'Warehouse stock not found');
    }
    return stock;
  }
}
