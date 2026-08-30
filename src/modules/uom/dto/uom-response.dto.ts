import { Uom } from '../entities/uom.entity';
import { UomCategory } from '../entities/uom-category.enum';

export interface UomResponseDto {
  id: string;
  companyId: string;
  code: string;
  name: string;
  symbol: string | null;
  category: UomCategory;
  decimalPlaces: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toUomResponseDto(uom: Uom): UomResponseDto {
  return {
    id: uom.id,
    companyId: uom.companyId,
    code: uom.code,
    name: uom.name,
    symbol: uom.symbol,
    category: uom.category,
    decimalPlaces: uom.decimalPlaces,
    isActive: uom.isActive,
    createdAt: uom.createdAt,
    updatedAt: uom.updatedAt,
  };
}
