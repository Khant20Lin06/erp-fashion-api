import { Repository } from 'typeorm';
import { ProductVariantUomsService } from './product-variant-uoms.service';
import { ProductVariantUom } from '../entities/product-variant-uom.entity';
import { ProductVariantUomUsageType } from '../entities/product-variant-uom-usage-type.enum';
import { ProductVariant } from '../entities/product-variant.entity';
import { Uom } from '../../uom/entities/uom.entity';
import { UomCategory } from '../../uom/entities/uom-category.enum';
import { ProductVariantsService } from './product-variants.service';
import { ErrorCode } from '../../../core/errors/error-codes';
import { PriceListItem } from '../entities/price-list-item.entity';

describe('ProductVariantUomsService', () => {
  let service: ProductVariantUomsService;
  let mappingRepository: jest.Mocked<
    Pick<
      Repository<ProductVariantUom>,
      'find' | 'findOne' | 'create' | 'save' | 'softRemove'
    >
  >;
  let uomRepository: jest.Mocked<Pick<Repository<Uom>, 'findOne'>>;
  let priceListItemRepository: jest.Mocked<
    Pick<Repository<PriceListItem>, 'count'>
  >;
  let variantsService: jest.Mocked<
    Pick<ProductVariantsService, 'findByIdInCompany'>
  >;

  const buildVariant = (
    overrides: Partial<ProductVariant> = {},
  ): ProductVariant =>
    ({
      id: 'variant-1',
      productId: 'product-1',
      companyId: 'company-a',
      sku: 'SKU-1',
      combinationKey: '',
      costPrice: '10.00',
      sellingPrice: '20.00',
      baseUomId: 'uom-pcs',
      ...overrides,
    }) as ProductVariant;

  const buildUom = (overrides: Partial<Uom> = {}): Uom =>
    ({
      id: 'uom-pcs',
      companyId: 'company-a',
      code: 'PCS',
      name: 'Pieces',
      symbol: 'pcs',
      category: UomCategory.Count,
      decimalPlaces: 0,
      isActive: true,
      ...overrides,
    }) as Uom;

  beforeEach(() => {
    mappingRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn((data: unknown) => data as ProductVariantUom) as never,
      save: jest.fn((data: unknown) =>
        Promise.resolve(data as ProductVariantUom),
      ) as never,
      softRemove: jest.fn().mockResolvedValue(undefined),
    };
    uomRepository = { findOne: jest.fn() };
    priceListItemRepository = { count: jest.fn().mockResolvedValue(0) };
    variantsService = {
      findByIdInCompany: jest.fn().mockResolvedValue(buildVariant()),
    };

    service = new ProductVariantUomsService(
      mappingRepository as unknown as Repository<ProductVariantUom>,
      uomRepository as unknown as Repository<Uom>,
      priceListItemRepository as unknown as Repository<PriceListItem>,
      variantsService as unknown as ProductVariantsService,
    );
  });

  it('rejects mapping a UOM whose category differs from the variant base UOM', async () => {
    uomRepository.findOne
      .mockResolvedValueOnce(
        buildUom({ id: 'uom-pcs', category: UomCategory.Count }),
      )
      .mockResolvedValueOnce(
        buildUom({
          id: 'uom-kg',
          code: 'KG',
          name: 'Kilogram',
          category: UomCategory.Weight,
        }),
      );

    await expect(
      service.create('variant-1', 'company-a', 'user-1', {
        uomId: 'uom-kg',
        conversionFactorToBase: '1.0000',
        usageType: ProductVariantUomUsageType.Sales,
      }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
  });

  it('stores an alternate UOM mapping when the category matches the base UOM', async () => {
    uomRepository.findOne
      .mockResolvedValueOnce(buildUom({ id: 'uom-pcs' }))
      .mockResolvedValueOnce(
        buildUom({ id: 'uom-box', code: 'BOX', name: 'Box' }),
      );
    mappingRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        ({
          id: 'mapping-1',
          variantId: 'variant-1',
          companyId: 'company-a',
          uomId: 'uom-box',
          conversionFactorToBase: '12.0000',
          usageType: ProductVariantUomUsageType.Both,
          barcode: null,
          isBase: false,
          isActive: true,
          uom: buildUom({ id: 'uom-box', code: 'BOX', name: 'Box' }),
        }) as ProductVariantUom,
      );

    const mapping = await service.create('variant-1', 'company-a', 'user-1', {
      uomId: 'uom-box',
      conversionFactorToBase: '12.0000',
      usageType: ProductVariantUomUsageType.Both,
    });

    expect(mapping.uomId).toBe('uom-box');
    expect(mapping.conversionFactorToBase).toBe('12.0000');
  });

  it('resolves the base UOM selection when no explicit UOM is requested', async () => {
    uomRepository.findOne.mockResolvedValue(buildUom());
    mappingRepository.findOne.mockResolvedValue(
      ({
        id: 'base-map-1',
        variantId: 'variant-1',
        companyId: 'company-a',
        uomId: 'uom-pcs',
        conversionFactorToBase: '1.0000',
        usageType: ProductVariantUomUsageType.Both,
        barcode: null,
        isBase: true,
        isActive: true,
      }) as ProductVariantUom,
    );

    const selection = await service.resolveSelectionForUsage(
      buildVariant(),
      'company-a',
      ProductVariantUomUsageType.Sales,
    );

    expect(selection).toMatchObject({
      uomId: 'uom-pcs',
      code: 'PCS',
      conversionFactorToBase: '1.0000',
      isBase: true,
    });
  });

  it('rejects selecting an alternate UOM whose usage type does not allow the requested transaction type', async () => {
    uomRepository.findOne.mockResolvedValue(
      buildUom({ id: 'uom-box', code: 'BOX', name: 'Box' }),
    );
    mappingRepository.findOne.mockResolvedValue(
      ({
        id: 'mapping-1',
        variantId: 'variant-1',
        companyId: 'company-a',
        uomId: 'uom-box',
        conversionFactorToBase: '12.0000',
        usageType: ProductVariantUomUsageType.Purchase,
        barcode: null,
        isBase: false,
        isActive: true,
        uom: buildUom({ id: 'uom-box', code: 'BOX', name: 'Box' }),
      }) as ProductVariantUom,
    );

    await expect(
      service.resolveSelectionForUsage(
        buildVariant(),
        'company-a',
        ProductVariantUomUsageType.Sales,
        'uom-box',
      ),
    ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
  });
});
