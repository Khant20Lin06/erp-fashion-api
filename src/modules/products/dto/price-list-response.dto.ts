import { PriceList } from '../entities/price-list.entity';
import { PriceListStatus } from '../entities/price-list-status.enum';

export interface PriceListResponseDto {
  id: string;
  companyId: string;
  code: string;
  name: string;
  description: string | null;
  currency: string;
  status: PriceListStatus;
  createdAt: Date;
  updatedAt: Date;
}

export function toPriceListResponseDto(
  priceList: PriceList,
): PriceListResponseDto {
  return {
    id: priceList.id,
    companyId: priceList.companyId,
    code: priceList.code,
    name: priceList.name,
    description: priceList.description,
    currency: priceList.currency,
    status: priceList.status,
    createdAt: priceList.createdAt,
    updatedAt: priceList.updatedAt,
  };
}
