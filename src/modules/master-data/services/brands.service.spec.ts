import { Repository, SelectQueryBuilder } from 'typeorm';
import { BrandsService } from './brands.service';
import { Brand } from '../entities/brand.entity';
import { BrandStatus } from '../entities/brand-status.enum';
import { CompaniesService } from '../../organization/services/companies.service';
import { Company } from '../../organization/entities/company.entity';
import { CompanyStatus } from '../../organization/entities/company-status.enum';
import { ErrorCode } from '../../../core/errors/error-codes';
import { Product } from '../../products/entities/product.entity';

describe('BrandsService', () => {
  let service: BrandsService;
  let brandRepository: jest.Mocked<
    Pick<
      Repository<Brand>,
      'findOne' | 'create' | 'save' | 'softRemove' | 'createQueryBuilder'
    >
  >;
  let productRepository: jest.Mocked<Pick<Repository<Product>, 'count'>>;
  let companiesService: jest.Mocked<
    Pick<CompaniesService, 'findActiveByIdOrNull'>
  >;
  let queryBuilder: jest.Mocked<
    Pick<
      SelectQueryBuilder<Brand>,
      'where' | 'andWhere' | 'orderBy' | 'skip' | 'take' | 'getManyAndCount'
    >
  >;

  const buildCompany = (overrides: Partial<Company> = {}): Company =>
    ({
      id: 'company-a',
      status: CompanyStatus.Active,
      ...overrides,
    }) as Company;

  const buildBrand = (overrides: Partial<Brand> = {}): Brand =>
    ({
      id: 'brand-1',
      companyId: 'company-a',
      code: 'NIKE',
      name: 'Nike',
      description: null,
      country: null,
      status: BrandStatus.Active,
      ...overrides,
    }) as Brand;

  beforeEach(() => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };
    brandRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softRemove: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    productRepository = {
      count: jest.fn(),
    };
    companiesService = { findActiveByIdOrNull: jest.fn() };

    service = new BrandsService(
      brandRepository as unknown as Repository<Brand>,
      productRepository as unknown as Repository<Product>,
      companiesService as unknown as CompaniesService,
    );
  });

  describe('create', () => {
    it('creates a brand when company is active and code is unique', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      brandRepository.findOne.mockResolvedValue(null);
      const created = buildBrand();
      brandRepository.create.mockReturnValue(created);
      brandRepository.save.mockResolvedValue(created);

      const result = await service.create('company-a', {
        code: 'NIKE',
        name: 'Nike',
      });

      expect(result).toBe(created);
    });

    it('auto-generates a brand code when none is provided', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      brandRepository.findOne.mockResolvedValue(null);
      const created = buildBrand({ code: 'BR-NIKE' });
      brandRepository.create.mockReturnValue(created);
      brandRepository.save.mockResolvedValue(created);

      const result = await service.create('company-a', {
        name: 'Nike',
      });

      expect(result).toBe(created);
      expect(brandRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'BR-NIKE' }),
      );
    });

    it('auto-generates a unique suffixed brand code when the base code already exists', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      brandRepository.findOne
        .mockResolvedValueOnce(buildBrand({ code: 'BR-NIKE' }))
        .mockResolvedValueOnce(null);
      const created = buildBrand({ code: 'BR-NIKE-2' });
      brandRepository.create.mockReturnValue(created);
      brandRepository.save.mockResolvedValue(created);

      await service.create('company-a', {
        name: 'Nike',
      });

      expect(brandRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'BR-NIKE-2' }),
      );
    });

    it('rejects when companyId does not reference an active company', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(null);

      await expect(
        service.create('missing', { code: 'NIKE', name: 'Nike' }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects a duplicate code within the same company (409)', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      brandRepository.findOne.mockResolvedValue(buildBrand());

      await expect(
        service.create('company-a', { code: 'NIKE', name: 'Duplicate' }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('allows the same code across two different companies (scoped uniqueness)', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(
        buildCompany({ id: 'company-b' }),
      );
      brandRepository.findOne.mockResolvedValue(null);
      const created = buildBrand({ id: 'brand-2', companyId: 'company-b' });
      brandRepository.create.mockReturnValue(created);
      brandRepository.save.mockResolvedValue(created);

      const result = await service.create('company-b', {
        code: 'NIKE',
        name: 'Nike (Co B)',
      });

      expect(result.companyId).toBe('company-b');
    });
  });

  describe('activate / deactivate', () => {
    it('deactivate sets status to INACTIVE', async () => {
      brandRepository.findOne.mockResolvedValue(buildBrand());
      brandRepository.save.mockImplementation((input) =>
        Promise.resolve(input as Brand),
      );

      const result = await service.deactivate('brand-1', 'company-a');

      expect(result.status).toBe(BrandStatus.Inactive);
    });
  });

  describe('findByIdInCompany — cross-company isolation', () => {
    it('throws NotFound for a brand belonging to a different company', async () => {
      brandRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findByIdInCompany('brand-1', 'company-b'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });
  });

  describe('remove', () => {
    it('rejects deletion when products are assigned to the brand', async () => {
      const brand = buildBrand();
      brandRepository.findOne.mockResolvedValue(brand);
      productRepository.count.mockResolvedValue(2);

      await expect(
        service.remove('brand-1', 'company-a'),
      ).rejects.toMatchObject({
        errorCode: ErrorCode.Conflict,
        message:
          'This brand cannot be deleted because 2 products are assigned to it. Move or delete those products first.',
      });
      expect(brandRepository.softRemove).not.toHaveBeenCalled();
    });

    it('soft-deletes the brand when no products are assigned', async () => {
      const brand = buildBrand();
      brandRepository.findOne.mockResolvedValue(brand);
      productRepository.count.mockResolvedValue(0);

      await service.remove('brand-1', 'company-a');

      expect(brandRepository.softRemove).toHaveBeenCalledWith(brand);
    });
  });
});
