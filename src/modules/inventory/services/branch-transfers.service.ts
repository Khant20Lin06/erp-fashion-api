import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { BranchTransfer } from '../entities/branch-transfer.entity';
import { BranchTransferItem } from '../entities/branch-transfer-item.entity';
import { BranchTransferStatus } from '../entities/branch-transfer-status.enum';
import { WarehouseStock } from '../entities/warehouse-stock.entity';
import { StockMovement } from '../entities/stock-movement.entity';
import { StockMovementType } from '../entities/stock-movement-type.enum';
import { StockMovementReferenceType } from '../entities/stock-movement-reference-type.enum';
import { CreateBranchTransferDto } from '../dto/create-branch-transfer.dto';
import { DispatchBranchTransferDto } from '../dto/dispatch-branch-transfer.dto';
import { ReceiveBranchTransferDto } from '../dto/receive-branch-transfer.dto';
import { ListBranchTransfersDto } from '../dto/list-branch-transfers.dto';
import {
  BranchTransferResponseDto,
  toBranchTransferItemResponseDto,
  toBranchTransferResponseDto,
} from '../dto/branch-transfer-response.dto';
import { formatDocumentNumber } from '../utils/document-number';
import { lockWarehouseStockRows, stockKey } from '../utils/stock-lock';
import { retryOnDuplicateEntry } from '../utils/upsert-retry';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { WarehousesService } from '../../organization/services/warehouses.service';
import { BranchesService } from '../../organization/services/branches.service';
import { WarehouseStatus } from '../../organization/entities/warehouse-status.enum';
import { BranchStatus } from '../../organization/entities/branch-status.enum';
import { ProductVariant } from '../../products/entities/product-variant.entity';
import { ProductVariantStatus } from '../../products/entities/product-variant-status.enum';
import { ProductVariantAttribute } from '../../products/entities/product-variant-attribute.entity';
import { Warehouse } from '../../organization/entities/warehouse.entity';
import { Branch } from '../../organization/entities/branch.entity';
import { User } from '../../users/entities/user.entity';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import { DEFAULT_LIMIT, DEFAULT_PAGE } from '../../../shared/dto/pagination.dto';

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export interface PaginatedBranchTransfers {
  data: BranchTransfer[];
  meta: { page: number; limit: number; total: number };
}

export interface PaginatedBranchTransferViews {
  data: BranchTransferResponseDto[];
  meta: { page: number; limit: number; total: number };
}

@Injectable()
export class BranchTransfersService {
  constructor(
    @InjectRepository(BranchTransfer)
    private readonly branchTransferRepository: Repository<BranchTransfer>,
    @InjectRepository(BranchTransferItem)
    private readonly branchTransferItemRepository: Repository<BranchTransferItem>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(ProductVariant)
    private readonly productVariantRepository: Repository<ProductVariant>,
    @InjectRepository(ProductVariantAttribute)
    private readonly productVariantAttributeRepository: Repository<ProductVariantAttribute>,
    private readonly transactionService: TransactionService,
    private readonly branchesService: BranchesService,
    private readonly warehousesService: WarehousesService,
  ) {}

  async findAllView(
    companyId: string,
    query: ListBranchTransfersDto,
  ): Promise<PaginatedBranchTransferViews> {
    const result = await this.findAll(companyId, query);
    return {
      data: await this.enrichTransfers(result.data),
      meta: result.meta,
    };
  }

  async findAll(
    companyId: string,
    query: ListBranchTransfersDto,
  ): Promise<PaginatedBranchTransfers> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;

    const qb = this.branchTransferRepository
      .createQueryBuilder('bt')
      .leftJoinAndSelect('bt.items', 'items')
      .where('bt.companyId = :companyId', { companyId });

    if (query.sourceBranchId) {
      qb.andWhere('bt.sourceBranchId = :sourceBranchId', {
        sourceBranchId: query.sourceBranchId,
      });
    }
    if (query.destinationBranchId) {
      qb.andWhere('bt.destinationBranchId = :destinationBranchId', {
        destinationBranchId: query.destinationBranchId,
      });
    }
    if (query.status) {
      qb.andWhere('bt.status = :status', { status: query.status });
    }

    qb.orderBy('bt.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { page, limit, total } };
  }

  async findByIdInCompany(
    id: string,
    companyId: string,
  ): Promise<BranchTransfer> {
    const transfer = await this.branchTransferRepository.findOne({
      where: { id, companyId },
      relations: { items: true },
    });
    if (!transfer) {
      throw new AppException(ErrorCode.NotFound, 'Branch transfer not found');
    }
    return transfer;
  }

  async findViewByIdInCompany(
    id: string,
    companyId: string,
  ): Promise<BranchTransferResponseDto> {
    const transfer = await this.findByIdInCompany(id, companyId);
    const [view] = await this.enrichTransfers([transfer]);
    if (!view) {
      throw new AppException(ErrorCode.NotFound, 'Branch transfer not found');
    }
    return view;
  }

  private async generateTransferNumber(
    companyId: string,
    year: number,
    manager: EntityManager,
  ): Promise<string> {
    const row = await manager
      .createQueryBuilder(BranchTransfer, 'bt')
      .where('bt.companyId = :companyId', { companyId })
      .andWhere('bt.transferNumber LIKE :prefix', { prefix: `BTR-${year}-%` })
      .orderBy('bt.createdAt', 'DESC')
      .addOrderBy('bt.transferNumber', 'DESC')
      .setLock('pessimistic_write')
      .getOne();

    let nextSequence = 1;
    if (row && row.transferNumber) {
      const parts = row.transferNumber.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!Number.isNaN(lastSeq)) {
        nextSequence = lastSeq + 1;
      }
    }
    return formatDocumentNumber('BTR', year, nextSequence);
  }

  async create(
    companyId: string,
    userId: string,
    dto: CreateBranchTransferDto,
  ): Promise<BranchTransfer> {
    if (dto.sourceBranchId === dto.destinationBranchId) {
      throw new AppException(
        ErrorCode.ValidationError,
        'sourceBranchId and destinationBranchId must be different',
      );
    }
    if (dto.sourceWarehouseId === dto.destinationWarehouseId) {
      throw new AppException(
        ErrorCode.ValidationError,
        'sourceWarehouseId and destinationWarehouseId must be different',
      );
    }

    const sourceBranch = await this.branchesService.findById(dto.sourceBranchId);
    const destBranch = await this.branchesService.findById(dto.destinationBranchId);

    if (sourceBranch.companyId !== companyId || destBranch.companyId !== companyId) {
      throw new AppException(
        ErrorCode.ValidationError,
        'Branches must belong to the resolved company',
      );
    }

    if (
      sourceBranch.status !== BranchStatus.Active ||
      destBranch.status !== BranchStatus.Active
    ) {
      throw new AppException(
        ErrorCode.ValidationError,
        'Both source and destination branches must be active',
      );
    }

    const sourceWarehouse = await this.warehousesService.findById(dto.sourceWarehouseId);
    const destWarehouse = await this.warehousesService.findById(dto.destinationWarehouseId);

    if (
      sourceWarehouse.status !== WarehouseStatus.Active ||
      destWarehouse.status !== WarehouseStatus.Active
    ) {
      throw new AppException(
        ErrorCode.ValidationError,
        'Both source and destination warehouses must be active',
      );
    }

    const year = new Date().getUTCFullYear();

    return this.transactionService.run(async (manager) => {
      // Validate every ProductVariant belongs to company and is ACTIVE
      for (const item of dto.items) {
        const variant = await manager.findOne(ProductVariant, {
          where: { id: item.productVariantId, companyId },
        });
        if (!variant) {
          throw new AppException(
            ErrorCode.NotFound,
            `Product variant ${item.productVariantId} not found`,
          );
        }
        if (variant.status !== ProductVariantStatus.Active) {
          throw new AppException(
            ErrorCode.ValidationError,
            `Product variant ${item.productVariantId} is not active`,
          );
        }
      }

      let transferNumber = '';
      await retryOnDuplicateEntry(async () => {
        transferNumber = await this.generateTransferNumber(companyId, year, manager);
      });

      const transfer = manager.create(BranchTransfer, {
        transferNumber,
        companyId,
        sourceBranchId: dto.sourceBranchId,
        sourceWarehouseId: dto.sourceWarehouseId,
        destinationBranchId: dto.destinationBranchId,
        destinationWarehouseId: dto.destinationWarehouseId,
        status: BranchTransferStatus.Requested,
        notes: dto.notes ?? null,
        createdBy: userId,
      });
      const savedTransfer = await manager.save(BranchTransfer, transfer);

      for (const item of dto.items) {
        const transferItem = manager.create(BranchTransferItem, {
          transferId: savedTransfer.id,
          productVariantId: item.productVariantId,
          requestedQuantity: item.requestedQuantity,
          shippedQuantity: 0,
          receivedQuantity: 0,
        });
        await manager.save(BranchTransferItem, transferItem);
      }

      savedTransfer.items = await manager.find(BranchTransferItem, {
        where: { transferId: savedTransfer.id },
      });

      return savedTransfer;
    });
  }

  async dispatch(
    id: string,
    companyId: string,
    userId: string,
    dto: DispatchBranchTransferDto,
  ): Promise<BranchTransfer> {
    return this.transactionService.run(async (manager) => {
      const transfer = await manager.findOne(BranchTransfer, {
        where: { id, companyId },
        relations: { items: true },
        lock: { mode: 'pessimistic_write' },
      });

      if (!transfer) {
        throw new AppException(ErrorCode.NotFound, 'Branch transfer not found');
      }

      if (transfer.status !== BranchTransferStatus.Requested) {
        throw new AppException(
          ErrorCode.Conflict,
          `Cannot dispatch transfer in status ${transfer.status}. Only REQUESTED transfers can be dispatched.`,
        );
      }

      // Map shipped quantities
      const shippedQtyMap = new Map<string, number>();
      if (dto.items && dto.items.length > 0) {
        for (const itm of dto.items) {
          shippedQtyMap.set(itm.productVariantId, itm.shippedQuantity);
        }
      }

      for (const item of transfer.items) {
        const shippedQty = shippedQtyMap.has(item.productVariantId)
          ? shippedQtyMap.get(item.productVariantId)!
          : item.requestedQuantity;
        item.shippedQuantity = shippedQty;
      }

      // Lock source warehouse stock rows
      const lockTargets = transfer.items.map((item) => ({
        warehouseId: transfer.sourceWarehouseId,
        productVariantId: item.productVariantId,
      }));
      const lockedRows = await lockWarehouseStockRows(manager, lockTargets);

      // Validate sufficiency
      for (const item of transfer.items) {
        const sourceRow = lockedRows.get(
          stockKey(transfer.sourceWarehouseId, item.productVariantId),
        );
        if (!sourceRow || sourceRow.onHandQuantity < item.shippedQuantity) {
          throw new AppException(
            ErrorCode.Conflict,
            `Insufficient stock for variant ${item.productVariantId} in source warehouse`,
          );
        }
      }

      // Deduct stock and record TRANSFER_OUT
      for (const item of transfer.items) {
        const sourceRow = lockedRows.get(
          stockKey(transfer.sourceWarehouseId, item.productVariantId),
        )!;
        sourceRow.onHandQuantity -= item.shippedQuantity;
        await manager.update(WarehouseStock, sourceRow.id, {
          onHandQuantity: sourceRow.onHandQuantity,
        });

        await manager.update(BranchTransferItem, item.id, {
          shippedQuantity: item.shippedQuantity,
        });

        const outMovement = manager.create(StockMovement, {
          warehouseId: transfer.sourceWarehouseId,
          productVariantId: item.productVariantId,
          movementType: StockMovementType.TransferOut,
          quantityChange: -item.shippedQuantity,
          quantityAfter: sourceRow.onHandQuantity,
          referenceType: StockMovementReferenceType.StockTransfer,
          referenceId: transfer.id,
          createdBy: userId,
        });
        await manager.save(StockMovement, outMovement);
      }

      transfer.status = BranchTransferStatus.InTransit;
      transfer.dispatchedAt = new Date();
      transfer.dispatchedBy = userId;
      if (dto.transitMethod !== undefined) transfer.transitMethod = dto.transitMethod;
      if (dto.trackingNumber !== undefined) transfer.trackingNumber = dto.trackingNumber;
      if (dto.driverName !== undefined) transfer.driverName = dto.driverName;
      if (dto.driverPhone !== undefined) transfer.driverPhone = dto.driverPhone;

      return manager.save(BranchTransfer, transfer);
    });
  }

  async receive(
    id: string,
    companyId: string,
    userId: string,
    dto: ReceiveBranchTransferDto,
  ): Promise<BranchTransfer> {
    return this.transactionService.run(async (manager) => {
      const transfer = await manager.findOne(BranchTransfer, {
        where: { id, companyId },
        relations: { items: true },
        lock: { mode: 'pessimistic_write' },
      });

      if (!transfer) {
        throw new AppException(ErrorCode.NotFound, 'Branch transfer not found');
      }

      if (transfer.status !== BranchTransferStatus.InTransit) {
        throw new AppException(
          ErrorCode.Conflict,
          `Cannot receive transfer in status ${transfer.status}. Only IN_TRANSIT transfers can be received.`,
        );
      }

      // Map received quantities
      const receivedQtyMap = new Map<string, number>();
      if (dto.items && dto.items.length > 0) {
        for (const itm of dto.items) {
          receivedQtyMap.set(itm.productVariantId, itm.receivedQuantity);
        }
      }

      for (const item of transfer.items) {
        const receivedQty = receivedQtyMap.has(item.productVariantId)
          ? receivedQtyMap.get(item.productVariantId)!
          : item.shippedQuantity;
        item.receivedQuantity = receivedQty;
      }

      // Lock destination warehouse stock rows
      const lockTargets = transfer.items.map((item) => ({
        warehouseId: transfer.destinationWarehouseId,
        productVariantId: item.productVariantId,
      }));
      const lockedRows = await lockWarehouseStockRows(manager, lockTargets);

      // Increase destination stock and record TRANSFER_IN
      for (const item of transfer.items) {
        const destRow = lockedRows.get(
          stockKey(transfer.destinationWarehouseId, item.productVariantId),
        )!;
        destRow.onHandQuantity += item.receivedQuantity;
        await manager.update(WarehouseStock, destRow.id, {
          onHandQuantity: destRow.onHandQuantity,
        });

        await manager.update(BranchTransferItem, item.id, {
          receivedQuantity: item.receivedQuantity,
        });

        const inMovement = manager.create(StockMovement, {
          warehouseId: transfer.destinationWarehouseId,
          productVariantId: item.productVariantId,
          movementType: StockMovementType.TransferIn,
          quantityChange: item.receivedQuantity,
          quantityAfter: destRow.onHandQuantity,
          referenceType: StockMovementReferenceType.StockTransfer,
          referenceId: transfer.id,
          createdBy: userId,
        });
        await manager.save(StockMovement, inMovement);
      }

      transfer.status = BranchTransferStatus.Completed;
      transfer.receivedAt = new Date();
      transfer.receivedBy = userId;
      if (dto.notes) {
        transfer.notes = transfer.notes
          ? `${transfer.notes}\nReceive note: ${dto.notes}`
          : `Receive note: ${dto.notes}`;
      }

      return manager.save(BranchTransfer, transfer);
    });
  }

  async cancel(
    id: string,
    companyId: string,
    userId: string,
  ): Promise<BranchTransfer> {
    return this.transactionService.run(async (manager) => {
      const transfer = await manager.findOne(BranchTransfer, {
        where: { id, companyId },
        relations: { items: true },
        lock: { mode: 'pessimistic_write' },
      });

      if (!transfer) {
        throw new AppException(ErrorCode.NotFound, 'Branch transfer not found');
      }

      if (transfer.status !== BranchTransferStatus.Requested) {
        throw new AppException(
          ErrorCode.Conflict,
          `Cannot cancel a transfer in status ${transfer.status}. Only REQUESTED transfers can be cancelled.`,
        );
      }

      transfer.status = BranchTransferStatus.Cancelled;
      return manager.save(BranchTransfer, transfer);
    });
  }

  async createView(
    companyId: string,
    userId: string,
    dto: CreateBranchTransferDto,
  ): Promise<BranchTransferResponseDto> {
    const transfer = await this.create(companyId, userId, dto);
    const [view] = await this.enrichTransfers([transfer]);
    if (!view) {
      throw new AppException(ErrorCode.InternalError, 'Failed to build branch transfer response');
    }
    return view;
  }

  async dispatchView(
    id: string,
    companyId: string,
    userId: string,
    dto: DispatchBranchTransferDto,
  ): Promise<BranchTransferResponseDto> {
    const transfer = await this.dispatch(id, companyId, userId, dto);
    const [view] = await this.enrichTransfers([transfer]);
    if (!view) {
      throw new AppException(ErrorCode.InternalError, 'Failed to build branch transfer response');
    }
    return view;
  }

  async receiveView(
    id: string,
    companyId: string,
    userId: string,
    dto: ReceiveBranchTransferDto,
  ): Promise<BranchTransferResponseDto> {
    const transfer = await this.receive(id, companyId, userId, dto);
    const [view] = await this.enrichTransfers([transfer]);
    if (!view) {
      throw new AppException(ErrorCode.InternalError, 'Failed to build branch transfer response');
    }
    return view;
  }

  async cancelView(
    id: string,
    companyId: string,
    userId: string,
  ): Promise<BranchTransferResponseDto> {
    const transfer = await this.cancel(id, companyId, userId);
    const [view] = await this.enrichTransfers([transfer]);
    if (!view) {
      throw new AppException(ErrorCode.InternalError, 'Failed to build branch transfer response');
    }
    return view;
  }

  async enrichTransfers(
    transfers: BranchTransfer[],
  ): Promise<BranchTransferResponseDto[]> {
    if (transfers.length === 0) return [];

    const transferIds = transfers.map((t) => t.id);
    const branchIds = unique(
      transfers.flatMap((t) => [t.sourceBranchId, t.destinationBranchId]),
    );
    const warehouseIds = unique(
      transfers.flatMap((t) => [t.sourceWarehouseId, t.destinationWarehouseId]),
    );
    const userIds = unique(
      transfers
        .flatMap((t) => [t.createdBy, t.dispatchedBy, t.receivedBy])
        .filter((id): id is string => Boolean(id)),
    );

    const hydratedItems = transfers.some((t) => !t.items)
      ? await this.branchTransferItemRepository.find({
          where: { transferId: In(transferIds) },
        })
      : [];

    const allItems = transfers
      .flatMap((t) => t.items ?? [])
      .concat(hydratedItems);

    const productVariantIds = unique(allItems.map((i) => i.productVariantId));

    const [branches, warehouses, users, variants, variantAttributes] =
      await Promise.all([
        branchIds.length > 0
          ? this.branchRepository.find({ where: { id: In(branchIds) } })
          : Promise.resolve([]),
        warehouseIds.length > 0
          ? this.warehouseRepository.find({ where: { id: In(warehouseIds) } })
          : Promise.resolve([]),
        userIds.length > 0
          ? this.userRepository.find({ where: { id: In(userIds) } })
          : Promise.resolve([]),
        productVariantIds.length > 0
          ? this.productVariantRepository.find({
              where: { id: In(productVariantIds) },
              relations: { product: true },
            })
          : Promise.resolve([]),
        productVariantIds.length > 0
          ? this.productVariantAttributeRepository.find({
              where: { variantId: In(productVariantIds) },
              relations: { option: true },
            })
          : Promise.resolve([]),
      ]);

    const branchNames = new Map(branches.map((b) => [b.id, b.name]));
    const warehouseNames = new Map(warehouses.map((w) => [w.id, w.name]));
    const usersById = new Map(users.map((u) => [u.id, u]));
    const variantsById = new Map(variants.map((v) => [v.id, v]));

    const variantLabels = new Map<string, string>();
    for (const variantId of productVariantIds) {
      const label = variantAttributes
        .filter((attr) => attr.variantId === variantId)
        .sort((a, b) => a.kind.localeCompare(b.kind))
        .map((attr) => attr.option?.value?.trim())
        .filter(Boolean)
        .join(' / ');
      if (label) {
        variantLabels.set(variantId, label);
      }
    }

    const itemsByTransferId = new Map<string, BranchTransferItem[]>();
    for (const item of allItems) {
      const bucket = itemsByTransferId.get(item.transferId) ?? [];
      if (!bucket.some((existing) => existing.id === item.id)) {
        bucket.push(item);
      }
      itemsByTransferId.set(item.transferId, bucket);
    }

    return transfers.map((transfer) => {
      const items = (itemsByTransferId.get(transfer.id) ?? []).map((item) => {
        const variant = variantsById.get(item.productVariantId);
        return toBranchTransferItemResponseDto(item, {
          productName: variant?.product?.name ?? null,
          sku: variant?.sku ?? null,
          variantLabel: variantLabels.get(item.productVariantId) ?? null,
        });
      });

      return toBranchTransferResponseDto(transfer, {
        sourceBranchName: branchNames.get(transfer.sourceBranchId) ?? null,
        sourceWarehouseName: warehouseNames.get(transfer.sourceWarehouseId) ?? null,
        destinationBranchName: branchNames.get(transfer.destinationBranchId) ?? null,
        destinationWarehouseName: warehouseNames.get(transfer.destinationWarehouseId) ?? null,
        createdByName: usersById.get(transfer.createdBy)?.displayName ?? null,
        dispatchedByName: transfer.dispatchedBy
          ? usersById.get(transfer.dispatchedBy)?.displayName ?? null
          : null,
        receivedByName: transfer.receivedBy
          ? usersById.get(transfer.receivedBy)?.displayName ?? null
          : null,
        items,
      });
    });
  }
}
