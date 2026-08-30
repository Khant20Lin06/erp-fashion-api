import { EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import { ProductsService } from './products.service';
import { Product } from '../entities/product.entity';
import { ProductStatus } from '../entities/product-status.enum';
import { ProductType } from '../entities/product-type.enum';
import { ProductVariant } from '../entities/product-variant.entity';
import { ProductVariantUom } from '../entities/product-variant-uom.entity';
import { CompaniesService } from '../../organization/services/companies.service';
import { Company } from '../../organization/entities/company.entity';
import { CompanyStatus } from '../../organization/entities/company-status.enum';
import { CategoriesService } from '../../master-data/services/categories.service';
import { Category } from '../../master-data/entities/category.entity';
import { CategoryStatus } from '../../master-data/entities/category-status.enum';
import { BrandsService } from '../../master-data/services/brands.service';
import { Brand } from '../../master-data/entities/brand.entity';
import { BrandStatus } from '../../master-data/entities/brand-status.enum';
import { CollectionsService } from '../../master-data/services/collections.service';
import { Collection } from '../../master-data/entities/collection.entity';
import { CollectionStatus } from '../../master-data/entities/collection-status.enum';
import { AttributeOptionsService } from '../../master-data/services/attribute-options.service';
import { AttributeOption } from '../../master-data/entities/attribute-option.entity';
import { AttributeOptionStatus } from '../../master-data/entities/attribute-option-status.enum';
import { AttributeKind } from '../../master-data/entities/attribute-kind.enum';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { ErrorCode } from '../../../core/errors/error-codes';
import { PurchaseOrderItem } from '../../purchase/entities/purchase-order-item.entity';
import { PurchaseOrderStatus } from '../../purchase/entities/purchase-order-status.enum';
import { Uom } from '../../uom/entities/uom.entity';
import { UomCategory } from '../../uom/entities/uom-category.enum';

describe('ProductsService', () => {
  let service: ProductsService;
  let productRepository: jest.Mocked<
    Pick<Repository<Product>, 'findOne' | 'softRemove' | 'createQueryBuilder'>
  >;
  let variantRepository: jest.Mocked<
    Pick<Repository<ProductVariant>, 'find' | 'softRemove'>
  >;
  let variantUomRepository: jest.Mocked<
    Pick<Repository<ProductVariantUom>, 'find' | 'softRemove'>
  >;
  let purchaseOrderItemRepository: jest.Mocked<
    Pick<Repository<PurchaseOrderItem>, 'find'>
  >;
  let uomRepository: jest.Mocked<Pick<Repository<Uom>, 'findOne'>>;
  let companiesService: jest.Mocked<
    Pick<CompaniesService, 'findActiveByIdOrNull'>
  >;
  let categoriesService: jest.Mocked<
    Pick<CategoriesService, 'findByIdInCompany'>
  >;
  let brandsService: jest.Mocked<Pick<BrandsService, 'findByIdInCompany'>>;
  let collectionsService: jest.Mocked<
    Pick<CollectionsService, 'findByIdInCompany'>
  >;
  let attributeOptionsService: jest.Mocked<
    Pick<AttributeOptionsService, 'findByIdInCompany'>
  >;
  let transactionService: { run: jest.Mock };
  let queryBuilder: jest.Mocked<
    Pick<
      SelectQueryBuilder<Product>,
      'where' | 'andWhere' | 'orderBy' | 'skip' | 'take' | 'getManyAndCount'
    >
  >;
  let managerMock: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
  };

  const buildCompany = (overrides: Partial<Company> = {}): Company =>
    ({
      id: 'company-a',
      status: CompanyStatus.Active,
      ...overrides,
    }) as Company;

  const buildCategory = (overrides: Partial<Category> = {}): Category =>
    ({
      id: 'category-1',
      companyId: 'company-a',
      status: CategoryStatus.Active,
      ...overrides,
    }) as Category;

  const buildBrand = (overrides: Partial<Brand> = {}): Brand =>
    ({
      id: 'brand-1',
      companyId: 'company-a',
      status: BrandStatus.Active,
      ...overrides,
    }) as Brand;

  const buildCollection = (overrides: Partial<Collection> = {}): Collection =>
    ({
      id: 'collection-1',
      companyId: 'company-a',
      status: CollectionStatus.Active,
      ...overrides,
    }) as Collection;

  const buildOption = (
    overrides: Partial<AttributeOption> = {},
  ): AttributeOption =>
    ({
      id: 'option-1',
      companyId: 'company-a',
      kind: AttributeKind.Color,
      code: 'BLACK',
      status: AttributeOptionStatus.Active,
      ...overrides,
    }) as AttributeOption;

  const buildUom = (overrides: Partial<Uom> = {}): Uom =>
    ({
      id: 'uom-1',
      companyId: 'company-a',
      code: 'PCS',
      name: 'Pieces',
      symbol: 'pcs',
      category: UomCategory.Count,
      decimalPlaces: 0,
      isActive: true,
      ...overrides,
    }) as Uom;

  const buildProduct = (overrides: Partial<Product> = {}): Product =>
    ({
      id: 'product-1',
      companyId: 'company-a',
      code: 'TSHIRT',
      name: 'T-Shirt',
      description: null,
      categoryId: 'category-1',
      brandId: 'brand-1',
      collectionId: null,
      productType: ProductType.Simple,
      status: ProductStatus.Active,
      ...overrides,
    }) as Product;

  beforeEach(() => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };
    productRepository = {
      findOne: jest.fn(),
      softRemove: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    variantRepository = { find: jest.fn(), softRemove: jest.fn() };
    variantUomRepository = {
      find: jest.fn().mockResolvedValue([]),
      softRemove: jest.fn(),
    };
    purchaseOrderItemRepository = { find: jest.fn().mockResolvedValue([]) };
    uomRepository = { findOne: jest.fn() };
    companiesService = { findActiveByIdOrNull: jest.fn() };
    categoriesService = { findByIdInCompany: jest.fn() };
    brandsService = { findByIdInCompany: jest.fn() };
    collectionsService = { findByIdInCompany: jest.fn() };
    attributeOptionsService = { findByIdInCompany: jest.fn() };

    managerMock = {
      create: jest.fn(
        (_entity: unknown, data: Record<string, unknown>) => data,
      ),
      save: jest.fn((_entity: unknown, data: Record<string, unknown>) =>
        Promise.resolve({ ...data, id: data.id ?? 'generated-id' }),
      ),
      findOne: jest.fn(),
    };
    transactionService = {
      run: jest.fn((work: (manager: EntityManager) => Promise<unknown>) =>
        work(managerMock as unknown as EntityManager),
      ),
    };

    service = new ProductsService(
      productRepository as unknown as Repository<Product>,
      variantRepository as unknown as Repository<ProductVariant>,
      variantUomRepository as unknown as Repository<ProductVariantUom>,
      purchaseOrderItemRepository as unknown as Repository<PurchaseOrderItem>,
      uomRepository as unknown as Repository<Uom>,
      companiesService as unknown as CompaniesService,
      categoriesService as unknown as CategoriesService,
      brandsService as unknown as BrandsService,
      collectionsService as unknown as CollectionsService,
      attributeOptionsService as unknown as AttributeOptionsService,
      transactionService as unknown as TransactionService,
    );
  });

  describe('create', () => {
    const validDto = {
      code: 'TSHIRT',
      name: 'T-Shirt',
      categoryId: 'category-1',
      brandId: 'brand-1',
      initialVariant: {
        sku: 'TSHIRT-001',
        costPrice: '10.00',
        sellingPrice: '20.00',
        attributes: [{ kind: AttributeKind.Color, optionId: 'option-1' }],
      },
    };

    it('creates a Product together with its initial ProductVariant and attribute rows transactionally', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      categoriesService.findByIdInCompany.mockResolvedValue(buildCategory());
      brandsService.findByIdInCompany.mockResolvedValue(buildBrand());
      attributeOptionsService.findByIdInCompany.mockResolvedValue(
        buildOption(),
      );
      productRepository.findOne.mockResolvedValue(null); // duplicate-code check
      managerMock.findOne.mockResolvedValue(null); // SKU-available check inside transaction

      const result = await service.create('company-a', validDto);

      expect(result.code).toBe('TSHIRT');
      expect(transactionService.run).toHaveBeenCalledTimes(1);
      expect(managerMock.save).toHaveBeenCalledWith(
        Product,
        expect.objectContaining({ code: 'TSHIRT', companyId: 'company-a' }),
      );
      expect(managerMock.save).toHaveBeenCalledWith(
        ProductVariant,
        expect.objectContaining({
          sku: 'TSHIRT-001',
          combinationKey: 'option-1',
        }),
      );
    });

    it('stores baseUomId on the initial variant when provided', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      categoriesService.findByIdInCompany.mockResolvedValue(buildCategory());
      brandsService.findByIdInCompany.mockResolvedValue(buildBrand());
      attributeOptionsService.findByIdInCompany.mockResolvedValue(
        buildOption(),
      );
      productRepository.findOne.mockResolvedValue(null);
      managerMock.findOne.mockResolvedValue(null);
      uomRepository.findOne.mockResolvedValue(buildUom());

      await service.create('company-a', {
        ...validDto,
        initialVariant: {
          ...validDto.initialVariant,
          baseUomId: 'uom-1',
        },
      });

      expect(managerMock.save).toHaveBeenCalledWith(
        ProductVariant,
        expect.objectContaining({ baseUomId: 'uom-1' }),
      );
      expect(managerMock.save).toHaveBeenCalledWith(
        ProductVariantUom,
        expect.objectContaining({
          uomId: 'uom-1',
          isBase: true,
        }),
      );
    });

    it('rejects when companyId does not reference an active company', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(null);

      await expect(service.create('missing', validDto)).rejects.toMatchObject({
        errorCode: ErrorCode.ValidationError,
      });
    });

    it('rejects when categoryId references an inactive category', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      categoriesService.findByIdInCompany.mockResolvedValue(
        buildCategory({ status: CategoryStatus.Inactive }),
      );

      await expect(service.create('company-a', validDto)).rejects.toMatchObject(
        {
          errorCode: ErrorCode.ValidationError,
        },
      );
    });

    it('rejects when brandId references an inactive brand', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      categoriesService.findByIdInCompany.mockResolvedValue(buildCategory());
      brandsService.findByIdInCompany.mockResolvedValue(
        buildBrand({ status: BrandStatus.Inactive }),
      );

      await expect(service.create('company-a', validDto)).rejects.toMatchObject(
        {
          errorCode: ErrorCode.ValidationError,
        },
      );
    });

    it('rejects when collectionId references an inactive collection', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      categoriesService.findByIdInCompany.mockResolvedValue(buildCategory());
      brandsService.findByIdInCompany.mockResolvedValue(buildBrand());
      collectionsService.findByIdInCompany.mockResolvedValue(
        buildCollection({ status: CollectionStatus.Inactive }),
      );

      await expect(
        service.create('company-a', {
          ...validDto,
          collectionId: 'collection-1',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects a duplicate product code within the same company (409)', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      categoriesService.findByIdInCompany.mockResolvedValue(buildCategory());
      brandsService.findByIdInCompany.mockResolvedValue(buildBrand());
      attributeOptionsService.findByIdInCompany.mockResolvedValue(
        buildOption(),
      );
      productRepository.findOne.mockResolvedValue(buildProduct());

      await expect(service.create('company-a', validDto)).rejects.toMatchObject(
        {
          errorCode: ErrorCode.Conflict,
        },
      );
    });

    it('rejects a duplicate SKU within the same company (409, checked inside the transaction)', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      categoriesService.findByIdInCompany.mockResolvedValue(buildCategory());
      brandsService.findByIdInCompany.mockResolvedValue(buildBrand());
      attributeOptionsService.findByIdInCompany.mockResolvedValue(
        buildOption(),
      );
      productRepository.findOne.mockResolvedValue(null);
      managerMock.findOne.mockResolvedValue({
        id: 'existing-variant',
      });

      await expect(service.create('company-a', validDto)).rejects.toMatchObject(
        {
          errorCode: ErrorCode.Conflict,
        },
      );
    });

    it('rejects an inactive attribute option reference', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      categoriesService.findByIdInCompany.mockResolvedValue(buildCategory());
      brandsService.findByIdInCompany.mockResolvedValue(buildBrand());
      productRepository.findOne.mockResolvedValue(null);
      attributeOptionsService.findByIdInCompany.mockResolvedValue(
        buildOption({ status: AttributeOptionStatus.Inactive }),
      );

      await expect(service.create('company-a', validDto)).rejects.toMatchObject(
        {
          errorCode: ErrorCode.ValidationError,
        },
      );
    });

    it('rejects duplicate attribute kinds within the same variant', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      categoriesService.findByIdInCompany.mockResolvedValue(buildCategory());
      brandsService.findByIdInCompany.mockResolvedValue(buildBrand());
      productRepository.findOne.mockResolvedValue(null);
      attributeOptionsService.findByIdInCompany.mockResolvedValue(
        buildOption(),
      );

      await expect(
        service.create('company-a', {
          ...validDto,
          initialVariant: {
            ...validDto.initialVariant,
            attributes: [
              { kind: AttributeKind.Color, optionId: 'option-1' },
              { kind: AttributeKind.Color, optionId: 'option-2' },
            ],
          },
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });
  });

  describe('findByIdInCompany — cross-company isolation (IDOR)', () => {
    it('throws NotFound (not Forbidden) for a product in a different company', async () => {
      productRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findByIdInCompany('product-1', 'company-b'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });
  });

  describe('remove', () => {
    it('soft-deletes product variants before deleting the product', async () => {
      productRepository.findOne.mockResolvedValue(buildProduct());
      const variants = [
        { id: 'variant-1', productId: 'product-1' },
        { id: 'variant-2', productId: 'product-1' },
      ] as ProductVariant[];
      variantRepository.find.mockResolvedValue(variants);

      await service.remove('product-1', 'company-a');

      expect(variantRepository.find).toHaveBeenCalledWith({
        where: { productId: 'product-1', companyId: 'company-a' },
      });
      expect(variantUomRepository.find).toHaveBeenCalled();
      expect(variantRepository.softRemove).toHaveBeenCalledWith(variants);
      expect(productRepository.softRemove).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'product-1' }),
      );
    });

    it('rejects deleting a product referenced by an open purchase order', async () => {
      productRepository.findOne.mockResolvedValue(buildProduct());
      variantRepository.find.mockResolvedValue([
        { id: 'variant-1', productId: 'product-1', companyId: 'company-a' },
      ] as ProductVariant[]);
      purchaseOrderItemRepository.find.mockResolvedValue([
        {
          id: 'poi-1',
          productVariantId: 'variant-1',
          purchaseOrder: {
            id: 'po-1',
            companyId: 'company-a',
            status: PurchaseOrderStatus.Confirmed,
          },
        },
      ] as unknown as PurchaseOrderItem[]);

      await expect(service.remove('product-1', 'company-a')).rejects.toMatchObject(
        { errorCode: ErrorCode.Conflict },
      );
      expect(variantRepository.softRemove).not.toHaveBeenCalled();
      expect(productRepository.softRemove).not.toHaveBeenCalled();
    });

    it('soft-deletes a product with no variants', async () => {
      const product = buildProduct();
      productRepository.findOne.mockResolvedValue(product);
      variantRepository.find.mockResolvedValue([]);

      await service.remove('product-1', 'company-a');

      expect(variantRepository.softRemove).not.toHaveBeenCalled();
      expect(productRepository.softRemove).toHaveBeenCalledWith(product);
    });
  });
});
