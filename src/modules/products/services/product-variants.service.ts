import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, EntityManager, Repository } from 'typeorm';
import { ProductVariant } from '../entities/product-variant.entity';
import { ProductVariantStatus } from '../entities/product-variant-status.enum';
import { ProductVariantAttribute } from '../entities/product-variant-attribute.entity';
import { ProductVariantUom } from '../entities/product-variant-uom.entity';
import { ProductVariantUomUsageType } from '../entities/product-variant-uom-usage-type.enum';
import { CreateProductVariantDto } from '../dto/create-product-variant.dto';
import { UpdateProductVariantDto } from '../dto/update-product-variant.dto';
import { ListProductVariantsDto } from '../dto/list-product-variants.dto';
import { VariantAttributeResponseDto } from '../dto/product-variant-response.dto';
import { ProductsService } from './products.service';
import { AttributeOptionsService } from '../../master-data/services/attribute-options.service';
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
import { PurchaseOrderItem } from '../../purchase/entities/purchase-order-item.entity';
import { PurchaseOrderStatus } from '../../purchase/entities/purchase-order-status.enum';
import { Uom } from '../../uom/entities/uom.entity';

export interface PaginatedProductVariants {
  data: ProductVariant[];
  meta: { page: number; limit: number; total: number };
}

const SORTABLE_FIELDS = ['createdAt', 'sku', 'status'] as const;

@Injectable()
export class ProductVariantsService {
  constructor(
    @InjectRepository(ProductVariant)
    private readonly variantRepository: Repository<ProductVariant>,
    @InjectRepository(ProductVariantAttribute)
    private readonly variantAttributeRepository: Repository<ProductVariantAttribute>,
    @InjectRepository(ProductVariantUom)
    private readonly variantUomRepository: Repository<ProductVariantUom>,
    @InjectRepository(PurchaseOrderItem)
    private readonly purchaseOrderItemRepository: Repository<PurchaseOrderItem>,
    @InjectRepository(Uom)
    private readonly uomRepository: Repository<Uom>,
    private readonly productsService: ProductsService,
    private readonly attributeOptionsService: AttributeOptionsService,
    private readonly transactionService: TransactionService,
  ) {}

  async findAllForProduct(
    productId: string,
    companyId: string,
    query: ListProductVariantsDto,
  ): Promise<PaginatedProductVariants> {
    // Confirms the product exists in this company before listing its variants (IDOR-safe).
    await this.productsService.findByIdInCompany(productId, companyId);

    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const sortField = resolveSortField(
      query.sort,
      SORTABLE_FIELDS,
      'createdAt',
    );

    const qb = this.variantRepository
      .createQueryBuilder('variant')
      .where('variant.productId = :productId', { productId })
      .andWhere('variant.companyId = :companyId', { companyId });

    if (query.status) {
      qb.andWhere('variant.status = :status', { status: query.status });
    }
    if (query.search) {
      qb.andWhere(
        new Brackets((sub) => {
          sub.where('variant.sku LIKE :search', {
            search: `%${query.search}%`,
          });
        }),
      );
    }

    qb.orderBy(`variant.${sortField}`, query.order ?? 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, meta: { page, limit, total } };
  }

  async findByIdInCompany(
    id: string,
    companyId: string,
  ): Promise<ProductVariant> {
    const variant = await this.variantRepository.findOne({
      where: { id, companyId },
    });
    if (!variant) {
      throw new AppException(ErrorCode.NotFound, 'Product variant not found');
    }
    return variant;
  }

  /**
   * Used by CustomerPortalService to resolve a bot-supplied SKU string
   * (e.g. from a "/order SKU-001 x2" Telegram command) to a real, active
   * product variant — never trusts a client-supplied productVariantId
   * directly for that path, since a raw SKU string carries no proof it
   * corresponds to a real/active variant in this company.
   */
  async findBySkuInCompany(
    companyId: string,
    sku: string,
  ): Promise<ProductVariant | null> {
    return this.variantRepository.findOne({ where: { companyId, sku } });
  }

  /**
   * Same lookup as findBySkuInCompany, but with the `product` relation
   * loaded — used only by CustomerPortalService's cart-display endpoint,
   * which needs product.name for a friendly line item and must not fall
   * back to the admin-facing findAll()'s full column set (costPrice,
   * margin, etc. — see ProductLookupTool's own docblock for the same
   * customer-safety rationale).
   */
  async findBySkuInCompanyWithProduct(
    companyId: string,
    sku: string,
  ): Promise<ProductVariant | null> {
    return this.variantRepository.findOne({
      where: { companyId, sku },
      relations: { product: true },
    });
  }

  async findAttributes(
    variantId: string,
  ): Promise<VariantAttributeResponseDto[]> {
    const rows = await this.variantAttributeRepository.find({
      where: { variantId },
      relations: { option: true },
    });
    return rows.map((row) => ({
      kind: row.kind,
      optionId: row.optionId,
      optionCode: row.option?.code,
      optionValue: row.option?.value,
      swatch: row.option?.swatch ?? null,
    }));
  }

  private async resolveAttributes(
    companyId: string,
    inputs: CreateProductVariantDto['attributes'],
  ): Promise<{
    combinationKey: string;
    attributes: Array<{ kind: string; optionId: string }>;
  }> {
    const seenKinds = new Set<string>();
    const attributes: Array<{ kind: string; optionId: string }> = [];

    for (const input of inputs ?? []) {
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

  private async assertNotLinkedToOpenPurchaseOrder(
    companyId: string,
    variantId: string,
  ): Promise<void> {
    const linkedItems = await this.purchaseOrderItemRepository.find({
      where: { productVariantId: variantId },
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
        'Cannot delete a product variant referenced by an open purchase order',
      );
    }
  }

  async create(
    productId: string,
    companyId: string,
    dto: CreateProductVariantDto,
  ): Promise<ProductVariant> {
    await this.productsService.findByIdInCompany(productId, companyId);

    const { combinationKey, attributes } = await this.resolveAttributes(
      companyId,
      dto.attributes,
    );
    const baseUom = await this.resolveBaseUom(companyId, dto.baseUomId);

    const existingCombination = await this.variantRepository.findOne({
      where: { productId, combinationKey },
    });
    if (existingCombination) {
      throw new AppException(
        ErrorCode.Conflict,
        'A variant with this exact attribute combination already exists for this product',
      );
    }

    return this.transactionService.run(async (manager) => {
      await this.assertSkuAvailable(companyId, dto.sku, manager);

      const variant = manager.create(ProductVariant, {
        productId,
        companyId,
        sku: dto.sku,
        combinationKey,
        costPrice: dto.costPrice,
        sellingPrice: dto.sellingPrice,
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

      return savedVariant;
    });
  }

  async update(
    id: string,
    companyId: string,
    dto: UpdateProductVariantDto,
  ): Promise<ProductVariant> {
    const variant = await this.findByIdInCompany(id, companyId);

    if (dto.costPrice !== undefined) variant.costPrice = dto.costPrice;
    if (dto.sellingPrice !== undefined) variant.sellingPrice = dto.sellingPrice;

    if (dto.attributes !== undefined) {
      const { combinationKey, attributes } = await this.resolveAttributes(
        companyId,
        dto.attributes,
      );

      const existingCombination = await this.variantRepository.findOne({
        where: { productId: variant.productId, combinationKey },
      });
      if (existingCombination && existingCombination.id !== id) {
        throw new AppException(
          ErrorCode.Conflict,
          'A variant with this exact attribute combination already exists for this product',
        );
      }

      variant.combinationKey = combinationKey;

      await this.transactionService.run(async (manager) => {
        await manager.save(ProductVariant, variant);
        await manager.delete(ProductVariantAttribute, { variantId: id });
        for (const attribute of attributes) {
          await manager.save(
            ProductVariantAttribute,
            manager.create(ProductVariantAttribute, {
              variantId: id,
              optionId: attribute.optionId,
              kind: attribute.kind as ProductVariantAttribute['kind'],
            }),
          );
        }
      });

      return variant;
    }

    return this.variantRepository.save(variant);
  }

  async activate(id: string, companyId: string): Promise<ProductVariant> {
    const variant = await this.findByIdInCompany(id, companyId);
    variant.status = ProductVariantStatus.Active;
    return this.variantRepository.save(variant);
  }

  async deactivate(id: string, companyId: string): Promise<ProductVariant> {
    const variant = await this.findByIdInCompany(id, companyId);
    variant.status = ProductVariantStatus.Inactive;
    return this.variantRepository.save(variant);
  }

  /**
   * Soft delete only. No Sales/Purchase/Inventory exists yet in this phase
   * to block on (matching Brand's own "no business records yet" precedent)
   * — the FK RESTRICT from PriceListItem/ProductVariantBarcode/
   * ProductVariantAttribute is the current backstop.
   */
  async remove(id: string, companyId: string): Promise<void> {
    const variant = await this.findByIdInCompany(id, companyId);
    await this.assertNotLinkedToOpenPurchaseOrder(companyId, id);
    const mappings = await this.variantUomRepository.find({
      where: { variantId: id, companyId },
    });
    if (mappings.length > 0) {
      await this.variantUomRepository.softRemove(mappings);
    }
    await this.variantRepository.softRemove(variant);
  }
}
