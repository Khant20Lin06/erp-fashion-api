import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AttributeKind } from '../../master-data/entities/attribute-kind.enum';

export class CatalogQueryDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  query?: string;
}

export class CatalogDiscoveryQueryDto extends CatalogQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  size?: string;

  @IsOptional()
  @Matches(/^\d{1,10}(?:\.\d{1,2})?$/)
  maxPrice?: string;

  @IsOptional()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsOptional()
  @IsIn(['exact', 'similar'])
  mode?: 'exact' | 'similar';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  offset?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2220)
  @Matches(/^[a-fA-F0-9,-]*$/)
  exclude?: string;
}

export interface CatalogAttribute {
  id: string;
  kind: AttributeKind;
  value: string;
}

export interface CatalogVariant {
  id: string;
  sku: string;
  unitPrice: string;
  /** Informational total in active company warehouses; not a reservation. */
  quantityAvailable: number;
  attributes: CatalogAttribute[];
}

export interface CatalogProduct {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  currency: string;
  variants: CatalogVariant[];
}

export interface CatalogListResponse {
  products: CatalogProduct[];
  hasMore: boolean;
}

export interface CatalogDiscoveryResponse {
  products: Array<CatalogProduct & { reason: string }>;
  hasMore: boolean;
  matchType: 'exact' | 'similar' | 'none' | 'currency_mismatch';
  next?: { mode: 'exact' | 'similar'; offset: number };
}
