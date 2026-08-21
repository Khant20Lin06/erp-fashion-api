import { Brand } from '../entities/brand.entity';
import { BrandStatus } from '../entities/brand-status.enum';

export interface BrandResponseDto {
  id: string;
  companyId: string;
  code: string;
  name: string;
  description: string | null;
  country: string | null;
  status: BrandStatus;
  productCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toBrandResponseDto(
  brand: Brand & { productCount?: number },
): BrandResponseDto {
  return {
    id: brand.id,
    companyId: brand.companyId,
    code: brand.code,
    name: brand.name,
    description: brand.description,
    country: brand.country,
    status: brand.status,
    productCount: brand.productCount ?? 0,
    createdAt: brand.createdAt,
    updatedAt: brand.updatedAt,
  };
}
