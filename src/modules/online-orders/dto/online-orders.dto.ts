import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { OnlineOrder } from '../entities/online-order.entity';
import { OnlineOrderSource } from '../entities/online-order-source.enum';
import { OnlineOrderStatus } from '../entities/online-order-status.enum';
import { SaleResponseDto, toSaleResponseDto } from '../../sales/dto/sale-response.dto';

export class ListOnlineOrdersDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsEnum(OnlineOrderSource)
  source?: OnlineOrderSource;

  @IsOptional()
  @IsEnum(OnlineOrderStatus)
  status?: OnlineOrderStatus;
}

export class UpdateOnlineOrderStatusDto {
  @IsEnum(OnlineOrderStatus)
  status!: OnlineOrderStatus;
}

export interface OnlineOrderResponseDto {
  id: string;
  companyId: string;
  saleId: string;
  customerId: string;
  customerName?: string | null;
  customerPhone?: string | null;
  source: OnlineOrderSource;
  status: OnlineOrderStatus;
  telegramUserId: string | null;
  telegramUsername: string | null;
  deliveryAddress: string;
  statusUpdatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  sale?: SaleResponseDto;
}

export function toOnlineOrderResponseDto(
  entity: OnlineOrder,
): OnlineOrderResponseDto {
  return {
    id: entity.id,
    companyId: entity.companyId,
    saleId: entity.saleId,
    customerId: entity.customerId,
    customerName: entity.customer?.name ?? null,
    customerPhone: entity.customer?.phone ?? null,
    source: entity.source,
    status: entity.status,
    telegramUserId: entity.telegramUserId,
    telegramUsername: entity.telegramUsername,
    deliveryAddress: entity.deliveryAddress,
    statusUpdatedAt: entity.statusUpdatedAt,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    sale: entity.sale ? toSaleResponseDto(entity.sale) : undefined,
  };
}
