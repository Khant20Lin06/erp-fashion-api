import { AttributeKind } from '../../modules/master-data/entities/attribute-kind.enum';

export type AttributeCatalogEntry = {
  kind: AttributeKind.Color | AttributeKind.Size;
  code: string;
  value: string;
  sortOrder: number;
  swatch?: string | null;
  aliases: string[];
};

const normalizeToken = (value: string): string =>
  value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');

export const COLOR_ATTRIBUTE_CATALOG: AttributeCatalogEntry[] = [
  {
    kind: AttributeKind.Color,
    code: 'ATTR-CLR-BLK',
    value: 'Black',
    swatch: '#000000',
    sortOrder: 0,
    aliases: ['black', 'blk', 'bla'],
  },
  {
    kind: AttributeKind.Color,
    code: 'ATTR-CLR-WHT',
    value: 'White',
    swatch: '#FFFFFF',
    sortOrder: 1,
    aliases: ['white', 'wht', 'whi'],
  },
  {
    kind: AttributeKind.Color,
    code: 'ATTR-CLR-NVY',
    value: 'Navy',
    swatch: '#1F3A5F',
    sortOrder: 2,
    aliases: ['navy', 'nav', 'nvy', 'navy blue', 'blue'],
  },
  {
    kind: AttributeKind.Color,
    code: 'ATTR-CLR-RED',
    value: 'Red',
    swatch: '#DC2626',
    sortOrder: 3,
    aliases: ['red'],
  },
  {
    kind: AttributeKind.Color,
    code: 'ATTR-CLR-GRN',
    value: 'Green',
    swatch: '#16A34A',
    sortOrder: 4,
    aliases: ['green', 'grn'],
  },
  {
    kind: AttributeKind.Color,
    code: 'ATTR-CLR-BEI',
    value: 'Beige',
    swatch: '#D6C6A5',
    sortOrder: 5,
    aliases: ['beige', 'bei'],
  },
  {
    kind: AttributeKind.Color,
    code: 'ATTR-CLR-GRY',
    value: 'Grey',
    swatch: '#6B7280',
    sortOrder: 6,
    aliases: ['grey', 'gray', 'gry', 'gre'],
  },
];

export const SIZE_ATTRIBUTE_CATALOG: AttributeCatalogEntry[] = [
  {
    kind: AttributeKind.Size,
    code: 'ATTR-SIZ-XS',
    value: 'XS',
    sortOrder: 0,
    aliases: ['xs', 'extra small'],
  },
  {
    kind: AttributeKind.Size,
    code: 'ATTR-SIZ-S',
    value: 'S',
    sortOrder: 1,
    aliases: ['s', 'small'],
  },
  {
    kind: AttributeKind.Size,
    code: 'ATTR-SIZ-M',
    value: 'M',
    sortOrder: 2,
    aliases: ['m', 'medium'],
  },
  {
    kind: AttributeKind.Size,
    code: 'ATTR-SIZ-L',
    value: 'L',
    sortOrder: 3,
    aliases: ['l', 'large'],
  },
  {
    kind: AttributeKind.Size,
    code: 'ATTR-SIZ-XL',
    value: 'XL',
    sortOrder: 4,
    aliases: ['xl', 'extra large'],
  },
  {
    kind: AttributeKind.Size,
    code: 'ATTR-SIZ-XXL',
    value: 'XXL',
    sortOrder: 5,
    aliases: ['xxl', 'double extra large', '2xl'],
  },
];

export const ATTRIBUTE_OPTION_CATALOG: AttributeCatalogEntry[] = [
  ...COLOR_ATTRIBUTE_CATALOG,
  ...SIZE_ATTRIBUTE_CATALOG,
];

export function findAttributeCatalogEntry(
  kind: AttributeKind.Color | AttributeKind.Size,
  rawValue: string,
): AttributeCatalogEntry | undefined {
  const normalized = normalizeToken(rawValue);
  const catalog =
    kind === AttributeKind.Color
      ? COLOR_ATTRIBUTE_CATALOG
      : SIZE_ATTRIBUTE_CATALOG;

  return catalog.find((entry) =>
    [entry.value, entry.code, ...entry.aliases]
      .map(normalizeToken)
      .includes(normalized),
  );
}

export function resolveLegacyVariantSelection(
  combinationKey: string,
  sku: string,
): {
  color: AttributeCatalogEntry;
  size: AttributeCatalogEntry;
} | null {
  const combination = combinationKey.trim();
  if (combination && !combination.includes('|')) {
    const parts = combination
      .split('-')
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      const size = findAttributeCatalogEntry(
        AttributeKind.Size,
        parts[parts.length - 1],
      );
      const color = findAttributeCatalogEntry(
        AttributeKind.Color,
        parts.slice(0, -1).join('-'),
      );
      if (color && size) {
        return { color, size };
      }
    }
  }

  const skuParts = sku
    .trim()
    .split('-')
    .map((part) => part.trim())
    .filter(Boolean);
  if (skuParts.length >= 2) {
    const size = findAttributeCatalogEntry(
      AttributeKind.Size,
      skuParts[skuParts.length - 1],
    );
    const color = findAttributeCatalogEntry(
      AttributeKind.Color,
      skuParts[skuParts.length - 2],
    );
    if (color && size) {
      return { color, size };
    }
  }

  return null;
}
