import { Repository, SelectQueryBuilder } from 'typeorm';
import { UomsService } from './uoms.service';
import { Uom } from '../entities/uom.entity';
import { UomCategory } from '../entities/uom-category.enum';
import { CompaniesService } from '../../organization/services/companies.service';
import { ErrorCode } from '../../../core/errors/error-codes';
import { ProductVariant } from '../../products/entities/product-variant.entity';
import { ProductVariantUom } from '../../products/entities/product-variant-uom.entity';
import { PriceListItem } from '../../products/entities/price-list-item.entity';

describe('UomsService', () => {
  let service: UomsService;
  let uomRepository: jest.Mocked<
    Pick<
      Repository<Uom>,
      'findOne' | 'create' | 'save' | 'softRemove' | 'createQueryBuilder'
    >
  >;
  let variantRepository: jest.Mocked<Pick<Repository<ProductVariant>, 'count'>>;
  let variantUomRepository: jest.Mocked<
    Pick<Repository<ProductVariantUom>, 'count'>
  >;
  let priceListItemRepository: jest.Mocked<
    Pick<Repository<PriceListItem>, 'count'>
  >;
  let companiesService: jest.Mocked<
    Pick<CompaniesService, 'findActiveByIdOrNull'>
  >;
  let queryBuilder: jest.Mocked<
    Pick<
      SelectQueryBuilder<Uom>,
      | 'where'
      | 'andWhere'
      | 'orderBy'
      | 'skip'
      | 'take'
      | 'getManyAndCount'
      | 'getOne'
    >
  >;

  const buildUom = (overrides: Partial<Uom> = {}): Uom =>
    ({
      id: 'uom-1',
      companyId: 'company-a',
      code: 'BOX',
      name: 'Box',
      symbol: 'box',
      category: UomCategory.Count,
      decimalPlaces: 0,
      isActive: true,
      ...overrides,
    }) as Uom;

  beforeEach(() => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getOne: jest.fn().mockResolvedValue(null),
    };
    uomRepository = {
      findOne: jest.fn(),
      create: jest.fn((data: unknown) => data as Uom) as never,
      save: jest.fn((data: unknown) => Promise.resolve(data as Uom)) as never,
      softRemove: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    variantRepository = { count: jest.fn().mockResolvedValue(0) };
    variantUomRepository = { count: jest.fn().mockResolvedValue(0) };
    priceListItemRepository = { count: jest.fn().mockResolvedValue(0) };
    companiesService = {
      findActiveByIdOrNull: jest.fn().mockResolvedValue({ id: 'company-a' }),
    };

    service = new UomsService(
      uomRepository as unknown as Repository<Uom>,
      variantRepository as unknown as Repository<ProductVariant>,
      variantUomRepository as unknown as Repository<ProductVariantUom>,
      priceListItemRepository as unknown as Repository<PriceListItem>,
      companiesService as unknown as CompaniesService,
    );
  });

  it('creates an active UOM with a unique code inside the company', async () => {
    queryBuilder.getOne.mockResolvedValue(null);

    const created = await service.create('company-a', 'user-1', {
      companyId: 'company-a',
      code: 'BOX',
      name: 'Box',
      category: UomCategory.Count,
      decimalPlaces: 0,
    });

    expect(created.code).toBe('BOX');
    expect(created.isActive).toBe(true);
  });

  it('rejects deleting a UOM referenced by variant mappings or price rows', async () => {
    uomRepository.findOne.mockResolvedValue(buildUom());
    variantUomRepository.count.mockResolvedValue(1);

    await expect(service.remove('uom-1', 'company-a')).rejects.toMatchObject({
      errorCode: ErrorCode.Conflict,
    });
  });
});
