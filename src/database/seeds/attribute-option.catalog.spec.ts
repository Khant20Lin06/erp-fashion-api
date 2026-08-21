import { AttributeKind } from '../../modules/master-data/entities/attribute-kind.enum';
import {
  findAttributeCatalogEntry,
  resolveLegacyVariantSelection,
} from './attribute-option.catalog';

describe('attribute-option.catalog', () => {
  it('maps legacy aliases to canonical catalog entries', () => {
    expect(findAttributeCatalogEntry(AttributeKind.Color, 'Blue')?.code).toBe(
      'ATTR-CLR-NVY',
    );
    expect(findAttributeCatalogEntry(AttributeKind.Size, 'Medium')?.code).toBe(
      'ATTR-SIZ-M',
    );
  });

  it('resolves legacy combination keys', () => {
    expect(
      resolveLegacyVariantSelection('Beige-XL', 'PROD-BULK-001-BEI-XL'),
    ).toMatchObject({
      color: { code: 'ATTR-CLR-BEI', value: 'Beige' },
      size: { code: 'ATTR-SIZ-XL', value: 'XL' },
    });
  });

  it('falls back to sku suffix tokens when combination keys are empty', () => {
    expect(
      resolveLegacyVariantSelection('', 'PROD-BULK-050-NAV-L'),
    ).toMatchObject({
      color: { code: 'ATTR-CLR-NVY', value: 'Navy' },
      size: { code: 'ATTR-SIZ-L', value: 'L' },
    });
  });
});
