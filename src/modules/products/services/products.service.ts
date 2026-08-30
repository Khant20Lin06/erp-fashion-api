import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, EntityManager, In, Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { ProductStatus } from '../entities/product-status.enum';
import { ProductType } from '../entities/product-type.enum';
import { ProductVariant } from '../entities/product-variant.entity';
import { ProductVariantAttribute } from '../entities/product-variant-attribute.entity';
import { ProductVariantStatus } from '../entities/product-variant-status.enum';
import { ProductVariantUom } from '../entities/product-variant-uom.entity';
import { ProductVariantUomUsageType } from '../entities/product-variant-uom-usage-type.enum';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { ListProductsDto } from '../dto/list-products.dto';
import { CompaniesService } from '../../organization/services/companies.service';
import { CategoriesService } from '../../master-data/services/categories.service';
import { BrandsService } from '../../master-data/services/brands.service';
import { CollectionsService } from '../../master-data/services/collections.service';
import { AttributeOptionsService } from '../../master-data/services/attribute-options.service';
import { CategoryStatus } from '../../master-data/entities/category-status.enum';
import { BrandStatus } from '../../master-data/entities/brand-status.enum';
import { CollectionStatus } from '../../master-data/entities/collection-status.enum';
import { AttributeOptionStatus } from '../../master-data/entities/attribute-option-status.enum';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
} from '../../../shared/dto/pagination.dto';
import { resolveSortField } from '../../../shared/dto/resolve-sort-field';
import { computeCombinationKey } from '../utils/combination-key';
import { CreateProductVariantDto } from '../dto/create-product-variant.dto';
import { PurchaseOrderItem } from '../../purchase/entities/purchase-order-item.entity';
import { PurchaseOrderStatus } from '../../purchase/entities/purchase-order-status.enum';
import { Uom } from '../../uom/entities/uom.entity';

export interface PaginatedProducts {
  data: Product[];
  meta: { page: number; limit: number; total: number };
}

const SORTABLE_FIELDS = ['createdAt', 'name', 'code', 'status'] as const;

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductVariant)
    private readonly variantRepository: Repository<ProductVariant>,
    @InjectRepository(ProductVariantUom)
    private readonly variantUomRepository: Repository<ProductVariantUom>,
    @InjectRepository(PurchaseOrderItem)
    private readonly purchaseOrderItemRepository: Repository<PurchaseOrderItem>,
    @InjectRepository(Uom)
    private readonly uomRepository: Repository<Uom>,
    private readonly companiesService: CompaniesService,
    private readonly categoriesService: CategoriesService,
    private readonly brandsService: BrandsService,
    private readonly collectionsService: CollectionsService,
    private readonly attributeOptionsService: AttributeOptionsService,
    private readonly transactionService: TransactionService,
  ) {}

  async findAll(
    companyId: string,
    query: ListProductsDto,
  ): Promise<PaginatedProducts> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const sortField = resolveSortField(
      query.sort,
      SORTABLE_FIELDS,
      'createdAt',
    );

    const qb = this.productRepository
      .createQueryBuilder('product')
      .where('product.companyId = :companyId', { companyId });

    if (query.categoryId) {
      qb.andWhere('product.categoryId = :categoryId', {
        categoryId: query.categoryId,
      });
    }
    if (query.brandId) {
      qb.andWhere('product.brandId = :brandId', { brandId: query.brandId });
    }
    if (query.collectionId) {
      qb.andWhere('product.collectionId = :collectionId', {
        collectionId: query.collectionId,
      });
    }
    if (query.status) {
      qb.andWhere('product.status = :status', { status: query.status });
    }
    if (query.productType) {
      qb.andWhere('product.productType = :productType', {
        productType: query.productType,
      });
    }
    if (query.search) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('product.name LIKE :search', {
              search: `%${query.search}%`,
            })
            .orWhere('product.code LIKE :search', {
              search: `%${query.search}%`,
            });
        }),
      );
    }

    qb.orderBy(`product.${sortField}`, query.order ?? 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, meta: { page, limit, total } };
  }

  async findByIdInCompany(id: string, companyId: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id, companyId },
    });
    if (!product) {
      throw new AppException(ErrorCode.NotFound, 'Product not found');
    }
    return product;
  }

  private async assertValidCategory(
    categoryId: string,
    companyId: string,
  ): Promise<void> {
    const category = await this.categoriesService.findByIdInCompany(
      categoryId,
      companyId,
    );
    if (category.status !== CategoryStatus.Active) {
      throw new AppException(
        ErrorCode.ValidationError,
        'categoryId must reference an active category',
      );
    }
  }

  private async assertValidBrand(
    brandId: string,
    companyId: string,
  ): Promise<void> {
    const brand = await this.brandsService.findByIdInCompany(
      brandId,
      companyId,
    );
    if (brand.status !== BrandStatus.Active) {
      throw new AppException(
        ErrorCode.ValidationError,
        'brandId must reference an active brand',
      );
    }
  }

  private async assertValidCollection(
    collectionId: string,
    companyId: string,
  ): Promise<void> {
    const collection = await this.collectionsService.findByIdInCompany(
      collectionId,
      companyId,
    );
    if (collection.status !== CollectionStatus.Active) {
      throw new AppException(
        ErrorCode.ValidationError,
        'collectionId must reference an active collection',
      );
    }
  }

  /** Resolves each attribute input to a validated {kind, optionId} pair and the combination key. */
  private async resolveVariantAttributes(
    companyId: string,
    variantDto: CreateProductVariantDto,
  ): Promise<{
    combinationKey: string;
    attributes: Array<{ kind: string; optionId: string }>;
  }> {
    const inputs = variantDto.attributes ?? [];

    const seenKinds = new Set<string>();
    const attributes: Array<{ kind: string; optionId: string }> = [];

    for (const input of inputs) {
      if (seenKinds.has(input.kind)) {
        throw new AppException(
          ErrorCode.ValidationError,
          `Duplicate attribute kind in variant: ${input.kind}`,
        );
      }
      seenKinds.add(input.kind);

      const option = await this.attributeOptionsService.findByIdInCompany(
        input.optionId,
        companyId,
      );
      if (option.status !== AttributeOptionStatus.Active) {
        throw new AppException(
          ErrorCode.ValidationError,
          `Attribute option ${input.optionId} must be active`,
        );
      }
      if (option.kind !== input.kind) {
        throw new AppException(
          ErrorCode.ValidationError,
          `Attribute option ${input.optionId} does not belong to kind ${input.kind}`,
        );
      }

      attributes.push({ kind: input.kind, optionId: input.optionId });
    }

    const combinationKey = computeCombinationKey(
      attributes.map((a) => a.optionId),
    );

    return { combinationKey, attributes };
  }

  private async assertSkuAvailable(
    companyId: string,
    sku: string,
    manager: EntityManager,
  ): Promise<void> {
    const existing = await manager.findOne(ProductVariant, {
      where: { companyId, sku },
    });
    if (existing) {
      throw new AppException(
        ErrorCode.Conflict,
        'SKU already exists for this company',
      );
    }
  }

  private async resolveBaseUom(
    companyId: string,
    baseUomId?: string,
  ): Promise<Uom | null> {
    if (!baseUomId) {
      return null;
    }

    const uom = await this.uomRepository.findOne({
      where: { id: baseUomId, companyId },
    });
    if (!uom || !uom.isActive) {
      throw new AppException(
        ErrorCode.ValidationError,
        'baseUomId must reference an active UOM in this company',
      );
    }

    return uom;
  }

  private async assertVariantsNotLinkedToOpenPurchaseOrders(
    companyId: string,
    variantIds: string[],
  ): Promise<void> {
    if (variantIds.length === 0) return;

    const linkedItems = await this.purchaseOrderItemRepository.find({
      where: { productVariantId: In(variantIds) },
      relations: { purchaseOrder: true },
    });

    const blockingItem = linkedItems.find(
      (item) =>
        item.purchaseOrder?.companyId === companyId &&
        item.purchaseOrder.status !== PurchaseOrderStatus.Cancelled,
    );

    if (blockingItem) {
      throw new AppException(
        ErrorCode.Conflict,
        'Cannot delete a product referenced by an open purchase order',
      );
    }
  }

  /**
   * Creates a Product together with its one initial ProductVariant (and any
   * attribute assignments) inside a single transaction (Phase 10
   * §Transactional Integrity, LOCKED — "Product + initial variant creation
   * if implemented as one operation"). Every Product, SIMPLE or VARIANT,
   * gets exactly one Variant row here; additional variants are added later
   * via ProductVariantsService.create().
   */
  async create(companyId: string, dto: CreateProductDto): Promise<Product> {
    const company = await this.companiesService.findActiveByIdOrNull(companyId);
    if (!company) {
      throw new AppException(
        ErrorCode.ValidationError,
        'companyId does not reference an active company',
      );
    }

    await this.assertValidCategory(dto.categoryId, companyId);
    await this.assertValidBrand(dto.brandId, companyId);
    if (dto.collectionId) {
      await this.assertValidCollection(dto.collectionId, companyId);
    }

    const existingCode = await this.productRepository.findOne({
      where: { companyId, code: dto.code },
    });
    if (existingCode) {
      throw new AppException(
        ErrorCode.Conflict,
        'Product code already exists for this company',
      );
    }

    const { combinationKey, attributes } = await this.resolveVariantAttributes(
      companyId,
      dto.initialVariant,
    );
    const baseUom = await this.resolveBaseUom(
      companyId,
      dto.initialVariant.baseUomId,
    );

    return this.transactionService.run(async (manager) => {
      await this.assertSkuAvailable(companyId, dto.initialVariant.sku, manager);

      const product = manager.create(Product, {
        companyId,
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        categoryId: dto.categoryId,
        brandId: dto.brandId,
        collectionId: dto.collectionId ?? null,
        productType: dto.productType ?? ProductType.Simple,
        status: ProductStatus.Active,
      });
      const savedProduct = await manager.save(Product, product);

      const variant = manager.create(ProductVariant, {
        productId: savedProduct.id,
        companyId,
        sku: dto.initialVariant.sku,
        combinationKey,
        costPrice: dto.initialVariant.costPrice,
        sellingPrice: dto.initialVariant.sellingPrice,
        baseUomId: baseUom?.id ?? null,
        status: ProductVariantStatus.Active,
      });
      const savedVariant = await manager.save(ProductVariant, variant);

      if (baseUom) {
        await manager.save(
          ProductVariantUom,
          manager.create(ProductVariantUom, {
            variantId: savedVariant.id,
            companyId,
            uomId: baseUom.id,
            conversionFactorToBase: '1.0000',
            usageType: ProductVariantUomUsageType.Both,
            barcode: null,
            isBase: true,
            isActive: true,
          }),
        );
      }

      for (const attribute of attributes) {
        await manager.save(
          ProductVariantAttribute,
          manager.create(ProductVariantAttribute, {
            variantId: savedVariant.id,
            optionId: attribute.optionId,
            kind: attribute.kind as ProductVariantAttribute['kind'],
          }),
        );
      }

      return savedProduct;
    });
  }

  async update(
    id: string,
    companyId: string,
    dto: UpdateProductDto,
  ): Promise<Product> {
    const product = await this.findByIdInCompany(id, companyId);

    if (dto.categoryId !== undefined) {
      await this.assertValidCategory(dto.categoryId, companyId);
      product.categoryId = dto.categoryId;
    }
    if (dto.brandId !== undefined) {
      await this.assertValidBrand(dto.brandId, companyId);
      product.brandId = dto.brandId;
    }
    if (dto.collectionId !== undefined) {
      if (dto.collectionId !== null) {
        await this.assertValidCollection(dto.collectionId, companyId);
      }
      product.collectionId = dto.collectionId;
    }
    if (dto.name !== undefined) product.name = dto.name;
    if (dto.description !== undefined) product.description = dto.description;

    return this.productRepository.save(product);
  }

  async activate(id: string, companyId: string): Promise<Product> {
    const product = await this.findByIdInCompany(id, companyId);
    product.status = ProductStatus.Active;
    return this.productRepository.save(product);
  }

  async deactivate(id: string, companyId: string): Promise<Product> {
    const product = await this.findByIdInCompany(id, companyId);
    product.status = ProductStatus.Inactive;
    return this.productRepository.save(product);
  }

  /** Soft delete the product together with its variants to keep Product Master cleanup usable. */
  async remove(id: string, companyId: string): Promise<void> {
    const product = await this.findByIdInCompany(id, companyId);
    const variants = await this.variantRepository.find({
      where: { productId: id, companyId },
    });
    await this.assertVariantsNotLinkedToOpenPurchaseOrders(
      companyId,
      variants.map((variant) => variant.id),
    );

    if (variants.length > 0) {
      const variantMappings = await this.variantUomRepository.find({
        where: { companyId, variantId: In(variants.map((variant) => variant.id)) },
      });
      if (variantMappings.length > 0) {
        await this.variantUomRepository.softRemove(variantMappings);
      }
      await this.variantRepository.softRemove(variants);
    }
    await this.productRepository.softRemove(product);
  }
}
