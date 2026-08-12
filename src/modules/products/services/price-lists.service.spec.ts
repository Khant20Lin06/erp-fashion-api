import { Repository, SelectQueryBuilder } from 'typeorm';
import { PriceListsService } from './price-lists.service';
import { PriceList } from '../entities/price-list.entity';
import { PriceListStatus } from '../entities/price-list-status.enum';
import { CompaniesService } from '../../organization/services/companies.service';
import { Company } from '../../organization/entities/company.entity';
import { CompanyStatus } from '../../organization/entities/company-status.enum';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('PriceListsService', () => {
  let service: PriceListsService;
  let priceListRepository: jest.Mocked<
    Pick<
      Repository<PriceList>,
      'findOne' | 'create' | 'save' | 'softRemove' | 'createQueryBuilder'
    >
  >;
  let companiesService: jest.Mocked<
    Pick<CompaniesService, 'findActiveByIdOrNull'>
  >;
  let queryBuilder: jest.Mocked<
    Pick<
      SelectQueryBuilder<PriceList>,
      'where' | 'andWhere' | 'orderBy' | 'skip' | 'take' | 'getManyAndCount'
    >
  >;

  const buildCompany = (overrides: Partial<Company> = {}): Company =>
    ({
      id: 'company-a',
      status: CompanyStatus.Active,
      ...overrides,
    }) as Company;

  const buildPriceList = (overrides: Partial<PriceList> = {}): PriceList =>
    ({
      id: 'price-list-1',
      companyId: 'company-a',
      code: 'RETAIL',
      name: 'Retail Price List',
      description: null,
      currency: 'USD',
      status: PriceListStatus.Active,
      ...overrides,
    }) as PriceList;

  beforeEach(() => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };
    priceListRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softRemove: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    companiesService = { findActiveByIdOrNull: jest.fn() };

    service = new PriceListsService(
      priceListRepository as unknown as Repository<PriceList>,
      companiesService as unknown as CompaniesService,
    );
  });

  describe('create', () => {
    it('creates a price list when company is active and code is unique', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      priceListRepository.findOne.mockResolvedValue(null);
      const created = buildPriceList();
      priceListRepository.create.mockReturnValue(created);
      priceListRepository.save.mockResolvedValue(created);

      const result = await service.create('company-a', {
        code: 'RETAIL',
        name: 'Retail Price List',
        currency: 'USD',
      });

      expect(result).toBe(created);
    });

    it('rejects when companyId does not reference an active company', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(null);

      await expect(
        service.create('missing', {
          code: 'RETAIL',
          name: 'X',
          currency: 'USD',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects a duplicate code within the same company (409)', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      priceListRepository.findOne.mockResolvedValue(buildPriceList());

      await expect(
        service.create('company-a', {
          code: 'RETAIL',
          name: 'Duplicate',
          currency: 'USD',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('allows the same code across two different companies (scoped uniqueness)', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(
        buildCompany({ id: 'company-b' }),
      );
      priceListRepository.findOne.mockResolvedValue(null);
      const created = buildPriceList({
        id: 'price-list-2',
        companyId: 'company-b',
      });
      priceListRepository.create.mockReturnValue(created);
      priceListRepository.save.mockResolvedValue(created);

      const result = await service.create('company-b', {
        code: 'RETAIL',
        name: 'Retail (Co B)',
        currency: 'USD',
      });

      expect(result.companyId).toBe('company-b');
    });
  });

  describe('findByIdInCompany — cross-company isolation (IDOR)', () => {
    it('throws NotFound (not Forbidden) for a price list in a different company', async () => {
      priceListRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findByIdInCompany('price-list-1', 'company-b'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });
  });

  describe('activate / deactivate', () => {
    it('deactivate sets status to INACTIVE', async () => {
      priceListRepository.findOne.mockResolvedValue(buildPriceList());
      priceListRepository.save.mockImplementation((input) =>
        Promise.resolve(input as PriceList),
      );

      const result = await service.deactivate('price-list-1', 'company-a');

      expect(result.status).toBe(PriceListStatus.Inactive);
    });
  });

  describe('remove', () => {
    it('soft-deletes the price list', async () => {
      const priceList = buildPriceList();
      priceListRepository.findOne.mockResolvedValue(priceList);

      await service.remove('price-list-1', 'company-a');

      expect(priceListRepository.softRemove).toHaveBeenCalledWith(priceList);
    });
  });
});
