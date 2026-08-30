import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductVariantUom } from '../entities/product-variant-uom.entity';
import { Uom } from '../../uom/entities/uom.entity';
import { ProductVariantsService } from './product-variants.service';
import { CreateProductVariantUomDto } from '../dto/create-product-variant-uom.dto';
import { UpdateProductVariantUomDto } from '../dto/update-product-variant-uom.dto';
import { ProductVariant } from '../entities/product-variant.entity';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import { PriceListItem } from '../entities/price-list-item.entity';
import { ProductVariantUomUsageType } from '../entities/product-variant-uom-usage-type.enum';

export interface ResolvedVariantUomSelection {
  uomId: string;
  code: string;
  name: string;
  symbol: string | null;
  conversionFactorToBase: string;
  usageType: ProductVariantUomUsageType;
  isBase: boolean;
}

@Injectable()
export class ProductVariantUomsService {
  constructor(
    @InjectRepository(ProductVariantUom)
    private readonly mappingRepository: Repository<ProductVariantUom>,
    @InjectRepository(Uom)
    private readonly uomRepository: Repository<Uom>,
    @InjectRepository(PriceListItem)
    private readonly priceListItemRepository: Repository<PriceListItem>,
    private readonly productVariantsService: ProductVariantsService,
  ) {}

  async findAllForVariant(
    variantId: string,
    companyId: string,
  ): Promise<ProductVariantUom[]> {
    await this.productVariantsService.findByIdInCompany(variantId, companyId);
    return this.mappingRepository.find({
      where: { variantId, companyId },
      relations: { uom: true },
      order: { isBase: 'DESC', createdAt: 'ASC' },
    });
  }

  async findByIdInCompany(
    id: string,
    companyId: string,
  ): Promise<ProductVariantUom> {
    const mapping = await this.mappingRepository.findOne({
      where: { id, companyId },
      relations: { uom: true },
    });
    if (!mapping) {
      throw new AppException(
        ErrorCode.NotFound,
        'Product variant UOM mapping not found',
      );
    }
    return mapping;
  }

  async resolveSupportedUomId(
    variant: ProductVariant,
    companyId: string,
    requestedUomId?: string | null,
  ): Promise<string | null> {
    const normalizedRequestedUomId = requestedUomId ?? null;
    if (!normalizedRequestedUomId) {
      return variant.baseUomId ?? null;
    }

    if (!variant.baseUomId) {
      throw new AppException(
        ErrorCode.ValidationError,
        'Variant does not have a base UOM configured yet',
      );
    }

    if (normalizedRequestedUomId === variant.baseUomId) {
      const baseUom = await this.findActiveUomOrThrow(variant.baseUomId, companyId);
      return baseUom.id;
    }

    const mapping = await this.mappingRepository.findOne({
      where: {
        variantId: variant.id,
        companyId,
        uomId: normalizedRequestedUomId,
        isActive: true,
      },
    });
    if (!mapping) {
      throw new AppException(
        ErrorCode.ValidationError,
        'Selected UOM is not mapped to this variant',
      );
    }

    return mapping.uomId;
  }

  async resolveSelectionForUsage(
    variant: ProductVariant,
    companyId: string,
    usage: ProductVariantUomUsageType,
    requestedUomId?: string | null,
  ): Promise<ResolvedVariantUomSelection | null> {
    const normalizedRequestedUomId = requestedUomId ?? null;

    if (!variant.baseUomId) {
      if (normalizedRequestedUomId) {
        throw new AppException(
          ErrorCode.ValidationError,
          'Variant does not have a base UOM configured yet',
        );
      }
      return null;
    }

    const resolvedUomId = normalizedRequestedUomId ?? variant.baseUomId;
    const uom = await this.findActiveUomOrThrow(resolvedUomId, companyId);

    if (resolvedUomId === variant.baseUomId) {
      const baseMapping = await this.mappingRepository.findOne({
        where: {
          variantId: variant.id,
          companyId,
          uomId: variant.baseUomId,
        },
      });

      return {
        uomId: uom.id,
        code: uom.code,
        name: uom.name,
        symbol: uom.symbol,
        conversionFactorToBase:
          baseMapping?.conversionFactorToBase ?? '1.0000',
        usageType: baseMapping?.usageType ?? ProductVariantUomUsageType.Both,
        isBase: true,
      };
    }

    const mapping = await this.mappingRepository.findOne({
      where: {
        variantId: variant.id,
        companyId,
        uomId: resolvedUomId,
        isActive: true,
      },
      relations: { uom: true },
    });
    if (!mapping) {
      throw new AppException(
        ErrorCode.ValidationError,
        'Selected UOM is not mapped to this variant',
      );
    }

    if (!this.isUsageAllowed(mapping.usageType, usage)) {
      throw new AppException(
        ErrorCode.ValidationError,
        `Selected UOM is not enabled for ${usage.toLowerCase()} transactions`,
      );
    }

    return {
      uomId: mapping.uomId,
      code: mapping.uom.code,
      name: mapping.uom.name,
      symbol: mapping.uom.symbol,
      conversionFactorToBase: mapping.conversionFactorToBase,
      usageType: mapping.usageType,
      isBase: false,
    };
  }

  async create(
    variantId: string,
    companyId: string,
    _userId: string,
    dto: CreateProductVariantUomDto,
  ): Promise<ProductVariantUom> {
    const variant = await this.productVariantsService.findByIdInCompany(
      variantId,
      companyId,
    );

    if (!variant.baseUomId) {
      throw new AppException(
        ErrorCode.ValidationError,
        'Variant must have a base UOM before alternate UOM mappings can be created',
      );
    }
    if (dto.uomId === variant.baseUomId) {
      throw new AppException(
        ErrorCode.Conflict,
        'Base UOM mapping is created automatically and cannot be duplicated',
      );
    }

    const baseUom = await this.findActiveUomOrThrow(variant.baseUomId, companyId);
    const targetUom = await this.findActiveUomOrThrow(dto.uomId, companyId);
    if (baseUom.category !== targetUom.category) {
      throw new AppException(
        ErrorCode.ValidationError,
        'Alternate UOM category must match the variant base UOM category',
      );
    }

    const existing = await this.mappingRepository.findOne({
      where: { variantId, companyId, uomId: dto.uomId },
    });
    if (existing) {
      throw new AppException(
        ErrorCode.Conflict,
        'This UOM is already mapped to the variant',
      );
    }

    const mapping = this.mappingRepository.create({
      variantId,
      companyId,
      uomId: dto.uomId,
      conversionFactorToBase: dto.conversionFactorToBase,
      usageType: dto.usageType,
      barcode: dto.barcode?.trim() || null,
      isBase: false,
      isActive: true,
    });

    const saved = await this.mappingRepository.save(mapping);
    return this.findByIdInCompany(saved.id, companyId);
  }

  async update(
    id: string,
    companyId: string,
    _userId: string,
    dto: UpdateProductVariantUomDto,
  ): Promise<ProductVariantUom> {
    const mapping = await this.findByIdInCompany(id, companyId);
    if (mapping.isBase) {
      throw new AppException(
        ErrorCode.Conflict,
        'Base UOM mapping cannot be edited through this endpoint',
      );
    }

    if (dto.conversionFactorToBase !== undefined) {
      mapping.conversionFactorToBase = dto.conversionFactorToBase;
    }
    if (dto.usageType !== undefined) {
      mapping.usageType = dto.usageType;
    }
    if (dto.barcode !== undefined) {
      mapping.barcode = dto.barcode?.trim() || null;
    }
    if (dto.isActive !== undefined) {
      mapping.isActive = dto.isActive;
    }

    const saved = await this.mappingRepository.save(mapping);
    return this.findByIdInCompany(saved.id, companyId);
  }

  async activate(
    id: string,
    companyId: string,
    userId: string,
  ): Promise<ProductVariantUom> {
    return this.update(id, companyId, userId, { isActive: true });
  }

  async deactivate(
    id: string,
    companyId: string,
    userId: string,
  ): Promise<ProductVariantUom> {
    return this.update(id, companyId, userId, { isActive: false });
  }

  async remove(id: string, companyId: string): Promise<void> {
    const mapping = await this.findByIdInCompany(id, companyId);
    if (mapping.isBase) {
      throw new AppException(
        ErrorCode.Conflict,
        'Base UOM mapping cannot be deleted',
      );
    }

    const priceRowCount = await this.priceListItemRepository.count({
      where: {
        companyId,
        productVariantId: mapping.variantId,
        uomId: mapping.uomId,
      },
    });
    if (priceRowCount > 0) {
      throw new AppException(
        ErrorCode.Conflict,
        'Variant UOM mapping is referenced by price list items and cannot be deleted',
      );
    }

    await this.mappingRepository.softRemove(mapping);
  }

  private async findActiveUomOrThrow(
    uomId: string,
    companyId: string,
  ): Promise<Uom> {
    const uom = await this.uomRepository.findOne({
      where: { id: uomId, companyId },
    });
    if (!uom || !uom.isActive) {
      throw new AppException(
        ErrorCode.ValidationError,
        'uomId does not reference an active UOM in this company',
      );
    }
    return uom;
  }

  private isUsageAllowed(
    actual: ProductVariantUomUsageType,
    expected: ProductVariantUomUsageType,
  ): boolean {
    return (
      actual === ProductVariantUomUsageType.Both || actual === expected
    );
  }
}
