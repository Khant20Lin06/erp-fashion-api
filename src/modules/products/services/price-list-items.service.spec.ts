import { Repository } from 'typeorm';
import { PriceListItemsService } from './price-list-items.service';
import { PriceListItem } from '../entities/price-list-item.entity';
import { PriceListItemStatus } from '../entities/price-list-item-status.enum';
import { PriceListsService } from './price-lists.service';
import { PriceList } from '../entities/price-list.entity';
import { ProductVariantsService } from './product-variants.service';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('PriceListItemsService', () => {
  let service: PriceListItemsService;
  let priceListItemRepository: jest.Mocked<
    Pick<
      Repository<PriceListItem>,
      'findOne' | 'find' | 'findAndCount' | 'create' | 'save' | 'softRemove'
    >
  >;
  let priceListsService: jest.Mocked<
    Pick<PriceListsService, 'findByIdInCompany'>
  >;
  let productVariantsService: jest.Mocked<
    Pick<ProductVariantsService, 'findByIdInCompany'>
  >;

  const buildPriceList = (overrides: Partial<PriceList> = {}): PriceList =>
    ({ id: 'price-list-1', companyId: 'company-a', ...overrides }) as PriceList;

  const buildItem = (overrides: Partial<PriceListItem> = {}): PriceListItem =>
    ({
      id: 'item-1',
      priceListId: 'price-list-1',
      productVariantId: 'variant-1',
      companyId: 'company-a',
      price: '20.00',
      validFrom: new Date('2026-01-01T00:00:00Z'),
      validTo: null,
      status: PriceListItemStatus.Active,
      ...overrides,
    }) as PriceListItem;

  beforeEach(() => {
    priceListItemRepository = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      findAndCount: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softRemove: jest.fn(),
    };
    priceListsService = {
      findByIdInCompany: jest.fn().mockResolvedValue(buildPriceList()),
    };
    productVariantsService = {
      findByIdInCompany: jest.fn().mockResolvedValue({ id: 'variant-1' }),
    };

    service = new PriceListItemsService(
      priceListItemRepository as unknown as Repository<PriceListItem>,
      priceListsService as unknown as PriceListsService,
      productVariantsService as unknown as ProductVariantsService,
    );
  });

  describe('create', () => {
    const dto = {
      productVariantId: 'variant-1',
      price: '20.00',
      validFrom: '2026-01-01T00:00:00Z',
    };

    it('creates a price list item for a valid variant with no overlap', async () => {
      priceListItemRepository.find.mockResolvedValue([]);
      const created = buildItem();
      priceListItemRepository.create.mockReturnValue(created);
      priceListItemRepository.save.mockResolvedValue(created);

      const result = await service.create('price-list-1', 'company-a', dto);

      expect(result).toBe(created);
      expect(productVariantsService.findByIdInCompany).toHaveBeenCalledWith(
        'variant-1',
        'company-a',
      );
    });

    it('rejects a variant belonging to a different company', async () => {
      productVariantsService.findByIdInCompany.mockRejectedValue(
        Object.assign(new Error('not found'), {
          errorCode: ErrorCode.NotFound,
        }),
      );

      await expect(
        service.create('price-list-1', 'company-a', dto),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });

    it('rejects a non-positive price', async () => {
      await expect(
        service.create('price-list-1', 'company-a', { ...dto, price: '0' }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects validTo at or before validFrom', async () => {
      await expect(
        service.create('price-list-1', 'company-a', {
          ...dto,
          validTo: '2025-12-31T00:00:00Z',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects an overlapping active window for the same (priceList, variant) pair (409)', async () => {
      // Existing open-ended row starting before the new row's validFrom.
      priceListItemRepository.find.mockResolvedValue([
        buildItem({
          validFrom: new Date('2025-06-01T00:00:00Z'),
          validTo: null,
        }),
      ]);

      await expect(
        service.create('price-list-1', 'company-a', dto),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('allows a new window that starts after an existing closed window ends', async () => {
      priceListItemRepository.find.mockResolvedValue([
        buildItem({
          validFrom: new Date('2025-01-01T00:00:00Z'),
          validTo: new Date('2025-12-31T00:00:00Z'),
        }),
      ]);
      const created = buildItem();
      priceListItemRepository.create.mockReturnValue(created);
      priceListItemRepository.save.mockResolvedValue(created);

      const result = await service.create('price-list-1', 'company-a', dto);

      expect(result).toBe(created);
    });
  });

  describe('update', () => {
    it('rejects a non-positive price', async () => {
      priceListItemRepository.findOne.mockResolvedValue(buildItem());

      await expect(
        service.update('item-1', 'company-a', { price: '-5' }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects closing validTo before the row own validFrom', async () => {
      priceListItemRepository.findOne.mockResolvedValue(
        buildItem({ validFrom: new Date('2026-06-01T00:00:00Z') }),
      );

      await expect(
        service.update('item-1', 'company-a', {
          validTo: '2026-01-01T00:00:00Z',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('updates the price without touching validTo', async () => {
      priceListItemRepository.findOne.mockResolvedValue(buildItem());
      priceListItemRepository.save.mockImplementation((input) =>
        Promise.resolve(input as PriceListItem),
      );

      const result = await service.update('item-1', 'company-a', {
        price: '25.00',
      });

      expect(result.price).toBe('25.00');
    });
  });

  describe('findByIdInCompany — cross-company isolation (IDOR)', () => {
    it('throws NotFound (not Forbidden) for an item in a different company', async () => {
      priceListItemRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findByIdInCompany('item-1', 'company-b'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });
  });

  describe('remove', () => {
    it('soft-deletes the price list item', async () => {
      const item = buildItem();
      priceListItemRepository.findOne.mockResolvedValue(item);

      await service.remove('item-1', 'company-a');

      expect(priceListItemRepository.softRemove).toHaveBeenCalledWith(item);
    });
  });
});
