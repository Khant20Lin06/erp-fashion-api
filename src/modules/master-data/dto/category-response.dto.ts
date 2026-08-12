import { Category } from '../entities/category.entity';
import { CategoryStatus } from '../entities/category-status.enum';

export interface CategoryResponseDto {
  id: string;
  companyId: string;
  code: string;
  name: string;
  description: string | null;
  parentId: string | null;
  status: CategoryStatus;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toCategoryResponseDto(category: Category): CategoryResponseDto {
  return {
    id: category.id,
    companyId: category.companyId,
    code: category.code,
    name: category.name,
    description: category.description,
    parentId: category.parentId,
    status: category.status,
    sortOrder: category.sortOrder,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}
