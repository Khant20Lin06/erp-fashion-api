import { EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import { ProductVariantsService } from './product-variants.service';
import { ProductVariant } from '../entities/product-variant.entity';
import { ProductVariantStatus } from '../entities/product-variant-status.enum';
import { ProductVariantAttribute } from '../entities/product-variant-attribute.entity';
import { ProductsService } from './products.service';
import { AttributeOptionsService } from '../../master-data/services/attribute-options.service';
import { AttributeOption } from '../../master-data/entities/attribute-option.entity';
import { AttributeOptionStatus } from '../../master-data/entities/attribute-option-status.enum';
import { AttributeKind } from '../../master-data/entities/attribute-kind.enum';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('ProductVariantsService', () => {
  let service: ProductVariantsService;
  let variantRepository: jest.Mocked<
    Pick<
      Repository<ProductVariant>,
      'findOne' | 'save' | 'softRemove' | 'createQueryBuilder'
    >
  >;
  let variantAttributeRepository: jest.Mocked<
    Pick<Repository<ProductVariantAttribute>, 'find'>
  >;
  let productsService: jest.Mocked<Pick<ProductsService, 'findByIdInCompany'>>;
  let attributeOptionsService: jest.Mocked<
    Pick<AttributeOptionsService, 'findByIdInCompany'>
  >;
  let transactionService: { run: jest.Mock };
  let queryBuilder: jest.Mocked<
    Pick<
      SelectQueryBuilder<ProductVariant>,
      'where' | 'andWhere' | 'orderBy' | 'skip' | 'take' | 'getManyAndCount'
    >
  >;
  let managerMock: {
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
    findOne: jest.Mock;
  };

  const buildVariant = (
    overrides: Partial<ProductVariant> = {},
  ): ProductVariant =>
    ({
      id: 'variant-1',
      productId: 'product-1',
      companyId: 'company-a',
      sku: 'TSHIRT-001',
      combinationKey: 'option-1',
      costPrice: '10.00',
      sellingPrice: '20.00',
      status: ProductVariantStatus.Active,
      ...overrides,
    }) as ProductVariant;

  const buildOption = (
    overrides: Partial<AttributeOption> = {},
  ): AttributeOption =>
    ({
      id: 'option-1',
      companyId: 'company-a',
      kind: AttributeKind.Size,
      code: 'M',
      status: AttributeOptionStatus.Active,
      ...overrides,
    }) as AttributeOption;

  beforeEach(() => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };
    variantRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      softRemove: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    variantAttributeRepository = { find: jest.fn().mockResolvedValue([]) };
    productsService = {
      findByIdInCompany: jest.fn().mockResolvedValue({ id: 'product-1' }),
    };
    attributeOptionsService = { findByIdInCompany: jest.fn() };

    managerMock = {
      create: jest.fn(
        (_entity: unknown, data: Record<string, unknown>) => data,
      ),
      save: jest.fn((_entity: unknown, data: Record<string, unknown>) =>
        Promise.resolve({ ...data, id: data.id ?? 'generated-id' }),
      ),
      delete: jest.fn(),
      findOne: jest.fn(),
    };
    transactionService = {
      run: jest.fn((work: (manager: EntityManager) => Promise<unknown>) =>
        work(managerMock as unknown as EntityManager),
      ),
    };

    service = new ProductVariantsService(
      variantRepository as unknown as Repository<ProductVariant>,
      variantAttributeRepository as unknown as Repository<ProductVariantAttribute>,
      productsService as unknown as ProductsService,
      attributeOptionsService as unknown as AttributeOptionsService,
      transactionService as unknown as TransactionService,
    );
  });

  describe('create', () => {
    const dto = {
      sku: 'TSHIRT-002',
      costPrice: '11.00',
      sellingPrice: '22.00',
      attributes: [{ kind: AttributeKind.Size, optionId: 'option-1' }],
    };

    it('creates a variant under an existing product with attribute assignments', async () => {
      attributeOptionsService.findByIdInCompany.mockResolvedValue(
        buildOption(),
      );
      variantRepository.findOne.mockResolvedValue(null); // combination-uniqueness check
      managerMock.findOne.mockResolvedValue(null); // SKU-available check

      const result = await service.create('product-1', 'company-a', dto);

      expect(result.sku).toBe('TSHIRT-002');
      expect(productsService.findByIdInCompany).toHaveBeenCalledWith(
        'product-1',
        'company-a',
      );
      expect(managerMock.save).toHaveBeenCalledWith(
        ProductVariantAttribute,
        expect.objectContaining({
          optionId: 'option-1',
          kind: AttributeKind.Size,
        }),
      );
    });

    it('rejects a duplicate SKU within the same company (409)', async () => {
      attributeOptionsService.findByIdInCompany.mockResolvedValue(
        buildOption(),
      );
      variantRepository.findOne.mockResolvedValue(null);
      managerMock.findOne.mockResolvedValue(buildVariant());

      await expect(
        service.create('product-1', 'company-a', dto),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('rejects a duplicate attribute combination under the same product (409)', async () => {
      attributeOptionsService.findByIdInCompany.mockResolvedValue(
        buildOption(),
      );
      variantRepository.findOne.mockResolvedValue(buildVariant());

      await expect(
        service.create('product-1', 'company-a', dto),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('rejects an attribute option belonging to a different kind than declared', async () => {
      attributeOptionsService.findByIdInCompany.mockResolvedValue(
        buildOption({ kind: AttributeKind.Color }),
      );

      await expect(
        service.create('product-1', 'company-a', dto),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects an inactive attribute option', async () => {
      attributeOptionsService.findByIdInCompany.mockResolvedValue(
        buildOption({ status: AttributeOptionStatus.Inactive }),
      );

      await expect(
        service.create('product-1', 'company-a', dto),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });
  });

  describe('findByIdInCompany — cross-company isolation (IDOR)', () => {
    it('throws NotFound (not Forbidden) for a variant in a different company', async () => {
      variantRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findByIdInCompany('variant-1', 'company-b'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });
  });

  describe('update', () => {
    it('updates cost/selling price without touching attributes', async () => {
      variantRepository.findOne.mockResolvedValue(buildVariant());
      variantRepository.save.mockImplementation((input) =>
        Promise.resolve(input as ProductVariant),
      );

      const result = await service.update('variant-1', 'company-a', {
        sellingPrice: '25.00',
      });

      expect(result.sellingPrice).toBe('25.00');
      expect(managerMock.delete).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('soft-deletes the variant', async () => {
      const variant = buildVariant();
      variantRepository.findOne.mockResolvedValue(variant);

      await service.remove('variant-1', 'company-a');

      expect(variantRepository.softRemove).toHaveBeenCalledWith(variant);
    });
  });
});
