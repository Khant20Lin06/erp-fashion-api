import type { CatalogProduct, CatalogVariant } from '../dto/catalog.dto';

export interface DiscoveryFilters {
  query?: string;
  family?: string;
  color?: string;
  size?: string;
  maxPrice?: string;
  currency?: string;
  intent?: 'chat' | 'product';
}
export function parseQuery(
  text: string,
  previous?: DiscoveryFilters,
): DiscoveryFilters & { query: string };
export function searchTerms(query: string): string[][];
export function canonicalColor(value: string): string;
export function priceCents(value: string): number | null;
export function eligibleVariants(
  product: CatalogProduct,
  filters?: DiscoveryFilters,
  relaxColor?: boolean,
): CatalogVariant[];
