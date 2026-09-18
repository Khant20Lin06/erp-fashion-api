import { DataSource, SelectQueryBuilder } from 'typeorm';
import { buildDataSourceOptions } from '../../../database/typeorm.options';
import { CustomerCatalogService } from './customer-catalog.service';
import { ErrorCode } from '../../../core/errors/error-codes';

class MetadataDataSource extends DataSource {
  async prepare() {
    await this.buildMetadatas();
  }
}

describe('CustomerCatalogService', () => {
  let source: MetadataDataSource;
  let service: CustomerCatalogService;
  let results: unknown[][];
  let queries: Array<{ sql: string; parameters: unknown[] }>;
  const product = {
    id: 'p1',
    name: 'Cotton shirt',
    description: null,
    imageUrl: 'https://images.example.com/shirt.jpg',
    currency: 'MMK',
  };
  const variant = {
    id: 'v1',
    sku: 'RED-M',
    unitPrice: '15000.00',
    combinationKey: 'red|size-m',
  };

  beforeAll(async () => {
    source = new MetadataDataSource(
      buildDataSourceOptions({
        host: 'localhost',
        port: 3306,
        username: '',
        password: '',
        database: 'catalog_test',
        poolSize: 1,
        logging: false,
      }),
    );
    await source.prepare();
  });
  beforeEach(() => {
    results = [];
    queries = [];
    jest
      .spyOn(SelectQueryBuilder.prototype, 'getRawMany')
      .mockImplementation(function (this: SelectQueryBuilder<object>) {
        const [sql, parameters] = this.getQueryAndParameters();
        queries.push({ sql, parameters });
        return Promise.resolve(results.shift() ?? []);
      });
    service = new CustomerCatalogService(source);
  });
  afterEach(() => jest.restoreAllMocks());

  it('popular products use confirmed same-currency sales and expose rank evidence without revenue', async () => {
    results = [
      [{ ...product, rank: 1 }],
      [variant],
      [
        { variantId: 'v1', id: 'red', kind: 'COLOR', value: 'Red' },
        { variantId: 'v1', id: 'size-m', kind: 'SIZE', value: 'M' },
      ],
      [{ variantId: 'v1', quantityAvailable: '2' }],
    ];
    const response = await service.popular('company-a', { size: 'M' });
    expect(response.products).toHaveLength(1);
    expect(response.products[0].reason).toContain('အရောင်း');
    expect(JSON.stringify(response)).not.toContain('revenue');
    expect(queries[0].parameters).toContain('CONFIRMED');
    expect(queries[0].parameters).toContain('company-a');
    expect(queries[0].sql).toContain(
      '`sale`.`currency` = `company`.`base_currency`',
    );
    expect(queries[0].sql).toContain('SUM(`item`.`line_total`)');
    expect(queries[0].sql).not.toContain(
      '`historicalVariant`.`deleted_at` IS NULL',
    );
    expect(queries[0].sql).toContain('`product`.`deleted_at` IS NULL');
  });

  it('searches active company variant SKUs for legacy cart commands', async () => {
    await service.list('company-a', 'TEE-BLK-M');
    expect(queries[0].sql).toContain('EXISTS');
    expect(queries[0].sql).toContain('`searchVariant`.`sku` LIKE ?');
    expect(queries[0].sql).toContain('`searchVariant`.`deleted_at` IS NULL');
    expect(queries[0].parameters).toContain('%TEE-BLK-M%');
    expect(queries[0].parameters).toContain('company-a');
  });

  it('does not treat the tee substring in Steel as a popular T-shirt', async () => {
    results = [[{ ...product, name: 'Steel belt' }]];
    const response = await service.popular('company-a', { query: 'tee' });
    expect(response.products).toEqual([]);
    expect(queries).toHaveLength(1);
  });

  it('discovers bilingual families with bounded tenant-scoped SQL and parameterized terms', async () => {
    await service.discover('company-a', { query: 'Pant ရောရှိလား' });
    expect(queries[0].parameters).toEqual(
      expect.arrayContaining(['company-a', '%pants%', '%ဘောင်းဘီ%']),
    );
    expect(queries[0].sql).toContain('`product`.`company_id` = ?');
    expect(queries[0].sql).toContain('`product`.`deleted_at` IS NULL');
    expect(queries[0].sql).toContain('LIMIT 13');
  });

  it('returns only actual in-stock variants within size and budget', async () => {
    results = [
      [product],
      [variant],
      [
        { variantId: 'v1', id: 'red', kind: 'COLOR', value: 'Red' },
        { variantId: 'v1', id: 'size-m', kind: 'SIZE', value: 'M' },
      ],
      [{ variantId: 'v1', quantityAvailable: '2' }],
    ];
    const response = await service.discover('company-a', {
      query: 'shirt',
      size: 'M',
      maxPrice: '15000.00',
      currency: 'MMK',
    });
    expect(response.products).toHaveLength(1);
    expect(response.products[0].variants[0].sku).toBe('RED-M');
    expect(response.products[0].reason).toContain('M');
    expect(response.matchType).toBe('exact');
  });

  it('offers explicitly similar colors while preserving size and budget', async () => {
    results = [
      [product],
      [variant],
      [
        { variantId: 'v1', id: 'red', kind: 'COLOR', value: 'Red' },
        { variantId: 'v1', id: 'size-m', kind: 'SIZE', value: 'M' },
      ],
      [{ variantId: 'v1', quantityAvailable: '2' }],
    ];
    const response = await service.discover('company-a', {
      query: 'shirt',
      color: 'black',
      size: 'M',
      mode: 'similar',
    });
    expect(response.products).toHaveLength(1);
    expect(response.products[0].reason).toContain('အရောင်');
    expect(response.matchType).toBe('similar');
  });

  it('does not call a bounded incomplete scan an unavailable catalog', async () => {
    results = [
      Array.from({ length: 13 }, (_, i) => ({ ...product, id: `p${i}` })),
    ];
    const response = await service.discover('company-a', { query: 'shirt' });
    expect(response.products).toHaveLength(0);
    expect(response.hasMore).toBe(true);
    expect(response.next).toEqual({ mode: 'exact', offset: 12 });
    expect(queries).toHaveLength(13); // one candidate query plus twelve empty variant projections
  });

  it('rejects substring-only product families such as Steel belt for tee and Underpants for pants', async () => {
    results = [[{ ...product, name: 'Steel belt' }]];
    expect(
      (
        await service.discover('company-a', {
          query: 'cotton tshirt',
          mode: 'similar',
        })
      ).products,
    ).toEqual([]);
    expect(queries).toHaveLength(1); // rejected before projecting variants
    results = [[{ ...product, name: 'Underpants' }]];
    expect(
      (
        await service.discover('company-a', {
          query: 'cargo pants',
          mode: 'similar',
        })
      ).products,
    ).toEqual([]);
    expect(queries).toHaveLength(2);
  });

  it('does not claim a color change when a similar product has the requested color', async () => {
    results = [
      [product],
      [variant],
      [
        { variantId: 'v1', id: 'red', kind: 'COLOR', value: 'Red' },
        { variantId: 'v1', id: 'size-m', kind: 'SIZE', value: 'M' },
      ],
      [{ variantId: 'v1', quantityAvailable: '2' }],
    ];
    const response = await service.discover('company-a', {
      query: 'linen shirt',
      color: 'red',
      mode: 'similar',
    });
    expect(response.products[0].reason).not.toContain('အရောင်ကွဲ');
  });

  it('projects grouped attributes and decimal prices without disclosing internal product or cost fields', async () => {
    results = [
      [{ ...product, costPrice: 'secret' }],
      [{ ...variant, costPrice: 'secret' }],
      [
        { variantId: 'v1', id: 'red', kind: 'COLOR', value: 'Red' },
        { variantId: 'v1', id: 'size-m', kind: 'SIZE', value: 'M' },
      ],
      [{ variantId: 'v1', quantityAvailable: '7' }],
    ];
    expect(await service.detail('company-a', 'p1')).toEqual({
      ...product,
      variants: [
        {
          id: 'v1',
          sku: 'RED-M',
          unitPrice: '15000.00',
          quantityAvailable: 7,
          attributes: [
            { id: 'red', kind: 'COLOR', value: 'Red' },
            { id: 'size-m', kind: 'SIZE', value: 'M' },
          ],
        },
      ],
    });
    expect(queries.some((query) => /cost_price/.test(query.sql))).toBe(false);
    const stock = queries.find((query) =>
      query.sql.includes('warehouse_stock'),
    )!;
    expect(stock.sql).toMatch(
      /SUM\(GREATEST\(0, .*on_hand_quantity.* - .*reserved_quantity.*\)\)/,
    );
    expect(stock.sql).toContain('`warehouse`.`company_id` = ?');
    expect(stock.sql).toContain('`warehouse`.`deleted_at` IS NULL');
    expect(stock.sql).toContain('`branch`.`status` = ?');
    expect(stock.parameters).toContain('company-a');
  });

  it('excludes variants whose options are missing, inactive, deleted or inconsistent instead of dropping their options', async () => {
    results = [
      [product],
      [variant],
      [{ variantId: 'v1', id: 'red', kind: 'COLOR', value: 'Red' }],
      [],
    ];
    expect((await service.detail('company-a', 'p1')).variants).toEqual([]);
    const attributes = queries.find((query) =>
      query.sql.includes('product_variant_attributes'),
    )!;
    expect(attributes.sql).toContain('`option`.`status` = ?');
    expect(attributes.sql).toContain('`option`.`company_id` = ?');
    expect(attributes.sql).toContain('`option`.`deleted_at` IS NULL');
    expect(attributes.sql).toContain('`attribute`.`deleted_at` IS NULL');
  });

  it('uses tenant and active/deleted filters on list and variant queries', async () => {
    results = [[product], []];
    await service.list('company-a', 'shirt');
    expect(queries[0].sql).toContain('`product`.`company_id` = ?');
    expect(queries[0].sql).toContain('`product`.`status` = ?');
    expect(queries[0].sql).toContain('`product`.`deleted_at` IS NULL');
    expect(queries[0].sql).toContain('LIMIT 7');
    expect(queries[0].sql).toContain(
      'EXISTS (SELECT 1 FROM `product_variants`',
    );
    expect(queries[0].sql).toContain('`searchVariant`.`sku` LIKE ?');
    expect(queries[0].sql).toContain('`searchVariant`.`company_id` = ?');
    expect(queries[0].sql).toContain('`searchVariant`.`status` = ?');
    expect(queries[0].sql).toContain('`searchVariant`.`deleted_at` IS NULL');
    expect(queries[0].parameters).toEqual(
      expect.arrayContaining(['company-a', 'ACTIVE', '%shirt%']),
    );
    expect(queries[1].sql).toContain('`variant`.`company_id` = ?');
    expect(queries[1].sql).toContain('`variant`.`status` = ?');
    expect(queries[1].sql).toContain('`variant`.`deleted_at` IS NULL');
    expect(queries[1].sql).toContain('LIMIT 101');
  });

  it('returns no more than six products and signals more results', async () => {
    results = [
      Array.from({ length: 7 }, (_, i) => ({ ...product, id: `p${i}` })),
    ];
    const response = await service.list('company-a');
    expect(response.products).toHaveLength(6);
    expect(response.hasMore).toBe(true);
  });

  it('rejects variant overflow explicitly', async () => {
    results = [
      [product],
      Array.from({ length: 101 }, (_, i) => ({ ...variant, id: `v${i}` })),
    ];
    await expect(service.detail('company-a', 'p1')).rejects.toMatchObject({
      errorCode: ErrorCode.ValidationError,
    });
  });

  it('returns not found for unavailable or other-company product IDs', async () => {
    await expect(
      service.detail('company-a', 'other-product'),
    ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    expect(queries[0].parameters).toEqual(
      expect.arrayContaining(['company-a', 'other-product']),
    );
  });

  it('uses text fallback for unsafe stored images and zero when no stock exists', async () => {
    results = [
      [{ ...product, imageUrl: 'https://localhost/a' }],
      [{ ...variant, combinationKey: '' }],
      [],
      [],
    ];
    const response = await service.detail('company-a', 'p1');
    expect(response.imageUrl).toBeNull();
    expect(response.variants[0].quantityAvailable).toBe(0);
  });
});
