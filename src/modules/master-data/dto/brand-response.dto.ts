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
  createdAt: Date;
  updatedAt: Date;
}

export function toBrandResponseDto(brand: Brand): BrandResponseDto {
  return {
    id: brand.id,
    companyId: brand.companyId,
    code: brand.code,
    name: brand.name,
    description: brand.description,
    country: brand.country,
    status: brand.status,
    createdAt: brand.createdAt,
    updatedAt: brand.updatedAt,
  };
}
