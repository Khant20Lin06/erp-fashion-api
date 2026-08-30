import { PriceListItem } from '../entities/price-list-item.entity';
import { PriceListItemStatus } from '../entities/price-list-item-status.enum';

export interface PriceListItemResponseDto {
  id: string;
  priceListId: string;
  productVariantId: string;
  companyId: string;
  uomId: string | null;
  price: string;
  validFrom: Date;
  validTo: Date | null;
  status: PriceListItemStatus;
  createdAt: Date;
  updatedAt: Date;
}

export function toPriceListItemResponseDto(
  item: PriceListItem,
): PriceListItemResponseDto {
  return {
    id: item.id,
    priceListId: item.priceListId,
    productVariantId: item.productVariantId,
    companyId: item.companyId,
    uomId: item.uomId,
    price: item.price,
    validFrom: item.validFrom,
    validTo: item.validTo,
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
