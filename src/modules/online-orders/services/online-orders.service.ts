import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { OnlineOrder } from '../entities/online-order.entity';
import { OnlineOrderStatus } from '../entities/online-order-status.enum';
import { OnlineOrderSource } from '../entities/online-order-source.enum';
import { CodStatus } from '../entities/cod-status.enum';
import { ListOnlineOrdersDto } from '../dto/online-orders.dto';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';

export interface PaginatedOnlineOrders {
  data: OnlineOrder[];
  meta: { page: number; limit: number; total: number };
}

/**
 * PENDING_REVIEW -> CONFIRMED -> PACKED -> ON_MY_WAY -> DELIVERED (terminal)
 * PENDING_REVIEW -> CANCELLED, CONFIRMED -> CANCELLED, PACKED -> CANCELLED
 * (a courier already en route (ON_MY_WAY) is not cancellable from here —
 * that is an out-of-band operational call, not a status button)
 * No transition is ever allowed FROM DELIVERED or CANCELLED — both terminal.
 * See online-order-status.enum.ts's own docblock for the full rationale.
 */
const ALLOWED_TRANSITIONS: Record<OnlineOrderStatus, OnlineOrderStatus[]> = {
  [OnlineOrderStatus.PendingReview]: [
    OnlineOrderStatus.Confirmed,
    OnlineOrderStatus.Cancelled,
  ],
  [OnlineOrderStatus.Confirmed]: [
    OnlineOrderStatus.Packed,
    OnlineOrderStatus.Cancelled,
  ],
  [OnlineOrderStatus.Packed]: [
    OnlineOrderStatus.OnMyWay,
    OnlineOrderStatus.Cancelled,
  ],
  [OnlineOrderStatus.OnMyWay]: [OnlineOrderStatus.Delivered],
  [OnlineOrderStatus.Delivered]: [],
  [OnlineOrderStatus.Cancelled]: [],
};

@Injectable()
export class OnlineOrdersService {
  constructor(
    @InjectRepository(OnlineOrder)
    private readonly onlineOrderRepository: Repository<OnlineOrder>,
  ) {}

  async findAll(
    companyId: string,
    query: ListOnlineOrdersDto,
  ): Promise<PaginatedOnlineOrders> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;

    const where: FindOptionsWhere<OnlineOrder> = {
      companyId,
      ...(query.source ? { source: query.source } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [data, total] = await this.onlineOrderRepository.findAndCount({
      where,
      relations: {
        customer: true,
        sale: {
          items: {
            productVariant: {
              attributes: {
                option: true,
              },
            },
          },
        },
      },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, meta: { page, limit, total } };
  }

  async findByIdInCompany(id: string, companyId: string): Promise<OnlineOrder> {
    const order = await this.onlineOrderRepository.findOne({
      where: { id, companyId },
      relations: {
        customer: true,
        sale: {
          items: {
            productVariant: {
              attributes: {
                option: true,
              },
            },
          },
        },
      },
    });
    if (!order) {
      throw new AppException(ErrorCode.NotFound, 'Online order not found');
    }
    return order;
  }

  /**
   * Called once per Sale, immediately after SalesService.create() has
   * already committed (see CustomerPortalService.createOrder's own
   * docblock for why this cannot share that transaction — SalesService.
   * create() owns and commits its own transaction internally, a locked
   * Sale-module boundary this service does not reach into). Not a second,
   * independent order-creation path — saleId must reference a real,
   * already-created Sale.
   */
  async createForSale(input: {
    companyId: string;
    saleId: string;
    customerId: string;
    source: OnlineOrderSource;
    telegramUserId: string | null;
    telegramUsername: string | null;
    deliveryAddress: string;
  }): Promise<OnlineOrder> {
    const findExisting = async (): Promise<OnlineOrder | null> => {
      const existing = await this.onlineOrderRepository.findOne({
        where: { saleId: input.saleId },
        withDeleted: true,
      });
      if (
        existing &&
        (existing.deletedAt ||
          existing.companyId !== input.companyId ||
          existing.customerId !== input.customerId ||
          existing.source !== input.source ||
          existing.telegramUserId !== input.telegramUserId ||
          existing.deliveryAddress !== input.deliveryAddress)
      ) {
        throw new AppException(
          ErrorCode.Conflict,
          'Online order already exists with different checkout details',
        );
      }
      return existing;
    };
    const existing = await findExisting();
    if (existing) return existing;
    const order = this.onlineOrderRepository.create({
      companyId: input.companyId,
      saleId: input.saleId,
      customerId: input.customerId,
      source: input.source,
      status: OnlineOrderStatus.PendingReview,
      telegramUserId: input.telegramUserId,
      telegramUsername: input.telegramUsername,
      deliveryAddress: input.deliveryAddress,
      statusUpdatedAt: new Date(),
    });
    try {
      return await this.onlineOrderRepository.save(order);
    } catch (error) {
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
        const winner = await findExisting();
        if (winner) return winner;
      }
      throw error;
    }
  }

  async updateStatus(
    id: string,
    companyId: string,
    targetStatus: OnlineOrderStatus,
  ): Promise<OnlineOrder> {
    const order = await this.findByIdInCompany(id, companyId);
    const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(targetStatus)) {
      throw new AppException(
        ErrorCode.Conflict,
        `Cannot transition online order from ${order.status} to ${targetStatus}`,
      );
    }
    order.status = targetStatus;
    order.statusUpdatedAt = new Date();
    return this.onlineOrderRepository.save(order);
  }

  async dispatch(
    id: string,
    companyId: string,
    dto: {
      courierService: string;
      trackingNumber?: string;
      codAmount?: string;
      riderName?: string;
      riderPhone?: string;
    },
  ): Promise<OnlineOrder> {
    const order = await this.findByIdInCompany(id, companyId);
    if (
      order.status !== OnlineOrderStatus.Packed &&
      order.status !== OnlineOrderStatus.Confirmed
    ) {
      throw new AppException(
        ErrorCode.Conflict,
        `Order must be CONFIRMED or PACKED before dispatch. Current status: ${order.status}`,
      );
    }
    order.courierService = dto.courierService;
    order.trackingNumber = dto.trackingNumber || null;
    order.riderName = dto.riderName || null;
    order.riderPhone = dto.riderPhone || null;
    if (dto.codAmount && parseFloat(dto.codAmount) > 0) {
      order.codAmount = dto.codAmount;
      order.codStatus = CodStatus.Pending;
    } else {
      order.codAmount = '0.00';
      order.codStatus = CodStatus.None;
    }
    order.status = OnlineOrderStatus.OnMyWay;
    order.statusUpdatedAt = new Date();
    return this.onlineOrderRepository.save(order);
  }

  async settleCod(
    id: string,
    companyId: string,
    userId: string,
    dto: { collectedAmount: string; notes?: string },
  ): Promise<OnlineOrder> {
    const order = await this.findByIdInCompany(id, companyId);
    if (order.codStatus !== CodStatus.Pending) {
      throw new AppException(
        ErrorCode.Conflict,
        `Only orders with PENDING COD can be settled. Current status: ${order.codStatus}`,
      );
    }
    order.codStatus = CodStatus.Settled;
    order.settledAt = new Date();
    order.settledBy = userId;
    return this.onlineOrderRepository.save(order);
  }
}
