import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { ProductVariant } from '../../products/entities/product-variant.entity';
import { Sale } from '../../sales/entities/sale.entity';
import { SaleItem } from '../../sales/entities/sale-item.entity';
import { SaleStatus } from '../../sales/entities/sale-status.enum';
import { ProductVariantAttribute } from '../../products/entities/product-variant-attribute.entity';
import { WarehouseStock } from '../../inventory/entities/warehouse-stock.entity';
import { ProductStatus } from '../../products/entities/product-status.enum';
import { ProductVariantStatus } from '../../products/entities/product-variant-status.enum';
import { AttributeOptionStatus } from '../../master-data/entities/attribute-option-status.enum';
import { AttributeKind } from '../../master-data/entities/attribute-kind.enum';
import { CompanyStatus } from '../../organization/entities/company-status.enum';
import { WarehouseStatus } from '../../organization/entities/warehouse-status.enum';
import { BranchStatus } from '../../organization/entities/branch-status.enum';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import { isPublicImageUrl } from '../../products/utils/public-image-url';
import { computeCombinationKey } from '../../products/utils/combination-key';
import {
  eligibleVariants,
  parseQuery,
  searchTerms,
} from '../shopping/discovery';
import {
  CatalogAttribute,
  CatalogListResponse,
  CatalogProduct,
  CatalogVariant,
  CatalogDiscoveryQueryDto,
  CatalogDiscoveryResponse,
} from '../dto/catalog.dto';

type ProductRow = Omit<CatalogProduct, 'variants'>;
type VariantRow = Pick<CatalogVariant, 'id' | 'sku' | 'unitPrice'> & {
  combinationKey: string;
};
type AttributeRow = CatalogAttribute & { variantId: string };
const PRODUCT_LIMIT = 6;
const VARIANT_LIMIT = 100;
const ATTRIBUTE_LIMIT = VARIANT_LIMIT * 8;

/** Bounded read model for customers. Never select cost prices or return full ORM entities. */
@Injectable()
export class CustomerCatalogService {
  constructor(private readonly source: DataSource) {}

  private products(companyId: string) {
    return this.source
      .getRepository(Product)
      .createQueryBuilder('product')
      .innerJoin(
        'product.company',
        'company',
        'company.status = :companyStatus',
        { companyStatus: CompanyStatus.Active },
      )
      .select('product.id', 'id')
      .addSelect('product.name', 'name')
      .addSelect('product.description', 'description')
      .addSelect('product.imageUrl', 'imageUrl')
      .addSelect('company.baseCurrency', 'currency')
      .where('product.companyId = :companyId', { companyId })
      .andWhere('product.status = :productStatus', {
        productStatus: ProductStatus.Active,
      });
  }

  async list(companyId: string, query?: string): Promise<CatalogListResponse> {
    const qb = this.products(companyId);
    if (query?.trim()) {
      const skuSearch = qb
        .subQuery()
        .select('1')
        .from(ProductVariant, 'searchVariant')
        .where('searchVariant.productId = product.id')
        .andWhere('searchVariant.companyId = :companyId')
        .andWhere('searchVariant.status = :searchStatus')
        .andWhere('searchVariant.sku LIKE :query')
        .getQuery();
      qb.andWhere(
        `(product.name LIKE :query OR product.code LIKE :query OR EXISTS ${skuSearch})`,
        {
          query: `%${query.trim()}%`,
          searchStatus: ProductVariantStatus.Active,
        },
      );
    }
    const rows = await qb
      .orderBy('product.name', 'ASC')
      .addOrderBy('product.id', 'ASC')
      .limit(PRODUCT_LIMIT + 1)
      .getRawMany<ProductRow>();
    const products: CatalogProduct[] = [];
    for (const product of rows.slice(0, PRODUCT_LIMIT)) {
      products.push(await this.project(companyId, product));
    }
    return { products, hasMore: rows.length > PRODUCT_LIMIT };
  }

  async detail(companyId: string, productId: string): Promise<CatalogProduct> {
    const rows = await this.products(companyId)
      .andWhere('product.id = :productId', { productId })
      .limit(1)
      .getRawMany<ProductRow>();
    if (!rows[0])
      throw new AppException(ErrorCode.NotFound, 'Product not found');
    return this.project(companyId, rows[0]);
  }

  async popular(
    companyId: string,
    filters: CatalogDiscoveryQueryDto,
  ): Promise<CatalogDiscoveryResponse> {
    // Match the existing sales-report metric: confirmed line revenue, all time.
    // Do not mix currencies or expose monetary aggregates to a customer/model.
    const qb = this.products(companyId)
      .innerJoin(
        (sub) =>
          sub
            .select('historicalVariant.id', 'id')
            .addSelect('historicalVariant.productId', 'productId')
            .from(ProductVariant, 'historicalVariant')
            .withDeleted()
            .where('historicalVariant.companyId = :companyId', { companyId }),
        'rankVariant',
        'rankVariant.productId = product.id',
      )
      .innerJoin(SaleItem, 'item', 'item.productVariantId = rankVariant.id')
      .innerJoin(
        Sale,
        'sale',
        'sale.id = item.saleId AND sale.companyId = :companyId AND sale.status = :saleStatus AND sale.currency = company.baseCurrency',
        { companyId, saleStatus: SaleStatus.Confirmed },
      )
      .groupBy('product.id')
      .addGroupBy('product.name')
      .addGroupBy('product.description')
      .addGroupBy('product.imageUrl')
      .addGroupBy('company.baseCurrency')
      .having('SUM(item.lineTotal) > 0')
      .orderBy('SUM(item.lineTotal)', 'DESC')
      .addOrderBy('product.id', 'ASC')
      .limit(20);
    for (const [i, alternatives] of searchTerms(
      filters.query || '',
    ).entries()) {
      const clauses = alternatives.map((term, j) => {
        const key = `popularTerm${i}_${j}`;
        qb.setParameter(key, `%${term.replace(/[\\%_]/g, '\\$&')}%`);
        return `(product.name LIKE :${key} OR product.code LIKE :${key})`;
      });
      qb.andWhere(`(${clauses.join(' OR ')})`);
    }
    const rows = await qb.getRawMany<ProductRow>();
    const products: CatalogDiscoveryResponse['products'] = [];
    const family = parseQuery(filters.query || '').family;
    let rank = 0;
    for (const row of rows) {
      if (family && parseQuery(row.name).family !== family) continue;
      rank++;
      if (filters.currency && row.currency !== filters.currency) continue;
      const product = await this.project(companyId, row);
      const variants = eligibleVariants(product, filters);
      if (!variants.length) continue;
      products.push({
        ...product,
        variants,
        reason: `${filters.query ? 'ဒီရှာဖွေမှုထဲက ' : ''}အတည်ပြုအရောင်း ရောင်းရငွေအရ အဆင့် ${rank} ပါ (ကာလအားလုံး၊ ${product.currency})။ လက်ရှိရွေးချယ်မှုနဲ့ ကိုက်ပြီး stock ရှိပါတယ်။`,
      });
      if (products.length === 3) break;
    }
    return {
      products,
      hasMore: false,
      matchType: products.length ? 'exact' : 'none',
    };
  }

  async discover(
    companyId: string,
    input: CatalogDiscoveryQueryDto,
  ): Promise<CatalogDiscoveryResponse> {
    const filters = { ...parseQuery(input.query || ''), ...input };
    // Normalize only the search text; explicit structured filters take precedence.
    const parsed = parseQuery(input.query || '');
    const mode = input.mode || 'exact';
    if (mode === 'similar' && !parsed.family)
      return { products: [], hasMore: false, matchType: 'none' };
    const query = mode === 'similar' ? parsed.family! : parsed.query;
    const qb = this.products(companyId);
    for (const [i, alternatives] of searchTerms(query).entries()) {
      const clauses = alternatives.map((term, j) => {
        const key = `term${i}_${j}`;
        // LIKE wildcards in a customer query are literal text, not a catalog dump.
        qb.setParameter(key, `%${term.replace(/[\\%_]/g, '\\$&')}%`);
        return `(product.name LIKE :${key} OR product.code LIKE :${key})`;
      });
      qb.andWhere(`(${clauses.join(' OR ')})`);
    }
    const offset = input.offset || 0;
    const candidates = await qb
      .orderBy('product.name', 'ASC')
      .addOrderBy('product.id', 'ASC')
      .offset(offset)
      .limit(13)
      .getRawMany<ProductRow>();
    const excluded = new Set((input.exclude || '').split(',').slice(0, 60));
    const products: CatalogDiscoveryResponse['products'] = [];
    let consumed = 0;
    let currencyMismatch = false;
    for (const row of candidates.slice(0, 12)) {
      consumed++;
      if (excluded.has(row.id)) continue;
      // SQL LIKE only narrows candidates: "tee" inside "Steel" is not a T-shirt.
      if (parsed.family && parseQuery(row.name).family !== parsed.family)
        continue;
      if (filters.currency && row.currency !== filters.currency) {
        currencyMismatch = true;
        continue;
      }
      const product = await this.project(companyId, row);
      const exactColor = eligibleVariants(product, filters);
      const variants =
        exactColor.length || mode === 'exact'
          ? exactColor
          : eligibleVariants(product, filters, true);
      if (!variants.length) continue;
      const changedColor =
        mode === 'similar' && !!filters.color && !exactColor.length;
      const reasons = [
        mode === 'similar'
          ? 'ရှာထားတဲ့ ပစ္စည်းအမျိုးအစားနဲ့ နီးစပ်တဲ့ ရွေးချယ်စရာပါ။'
          : 'ရှာထားတဲ့ အမည်နဲ့ ကိုက်ညီပြီး လက်ကျန်ရှိပါတယ်။',
      ];
      if (changedColor)
        reasons.push('အရောင်ကွဲ ရွေးချယ်စရာပါ — card ထဲက အရောင်ကို စစ်ပေးပါ။');
      if (filters.size) reasons.push(`Size ${filters.size} ရပါတယ်။`);
      if (filters.maxPrice)
        reasons.push(`${filters.maxPrice} ${product.currency} အတွင်းပါ။`);
      if (changedColor) {
        const colors = [
          ...new Set(
            variants.flatMap((v) =>
              v.attributes
                .filter((a) => a.kind === AttributeKind.Color)
                .map((a) => a.value),
            ),
          ),
        ];
        reasons.push(`အရောင်: ${colors.slice(0, 8).join(', ')}`);
      }
      products.push({ ...product, variants, reason: reasons.join('\n') });
      if (products.length === 3) break;
    }
    let next: CatalogDiscoveryResponse['next'];
    if (candidates.length > consumed && offset + consumed <= 10000)
      next = { mode, offset: offset + consumed };
    else if (
      mode === 'exact' &&
      parsed.family &&
      (parsed.query !== parsed.family || filters.color)
    )
      next = { mode: 'similar', offset: 0 };
    return {
      products,
      hasMore: !!next,
      matchType: products.length
        ? mode
        : currencyMismatch
          ? 'currency_mismatch'
          : 'none',
      ...(next ? { next } : {}),
    };
  }

  private async project(
    companyId: string,
    product: ProductRow,
  ): Promise<CatalogProduct> {
    const rows = await this.source
      .getRepository(ProductVariant)
      .createQueryBuilder('variant')
      .select('variant.id', 'id')
      .addSelect('variant.sku', 'sku')
      .addSelect('variant.sellingPrice', 'unitPrice')
      .addSelect('variant.combinationKey', 'combinationKey')
      .where('variant.companyId = :companyId', { companyId })
      .andWhere('variant.productId = :productId', { productId: product.id })
      .andWhere('variant.status = :variantStatus', {
        variantStatus: ProductVariantStatus.Active,
      })
      .orderBy('variant.sku', 'ASC')
      .addOrderBy('variant.id', 'ASC')
      .limit(VARIANT_LIMIT + 1)
      .getRawMany<VariantRow>();
    if (rows.length > VARIANT_LIMIT) {
      throw new AppException(
        ErrorCode.ValidationError,
        'This product has too many variants for chat shopping; please contact staff',
      );
    }
    const variants: CatalogVariant[] = [];
    if (rows.length) {
      const ids = rows.map((row) => row.id);
      const attributes = await this.source
        .getRepository(ProductVariantAttribute)
        .createQueryBuilder('attribute')
        .innerJoin(
          'attribute.option',
          'option',
          'option.companyId = :companyId AND option.status = :optionStatus AND option.kind = attribute.kind',
          { companyId, optionStatus: AttributeOptionStatus.Active },
        )
        .select('attribute.variantId', 'variantId')
        .addSelect('option.id', 'id')
        .addSelect('option.kind', 'kind')
        .addSelect('option.value', 'value')
        .where('attribute.variantId IN (:...ids)', { ids })
        .orderBy('option.kind', 'ASC')
        .addOrderBy('option.id', 'ASC')
        .limit(ATTRIBUTE_LIMIT + 1)
        .getRawMany<AttributeRow>();
      if (attributes.length > ATTRIBUTE_LIMIT) {
        throw new AppException(
          ErrorCode.ValidationError,
          'Too many variant options for chat shopping; please contact staff',
        );
      }
      const stock = await this.source
        .getRepository(WarehouseStock)
        .createQueryBuilder('stock')
        .innerJoin(
          'stock.warehouse',
          'warehouse',
          'warehouse.companyId = :companyId AND warehouse.status = :warehouseStatus',
          { companyId, warehouseStatus: WarehouseStatus.Active },
        )
        .innerJoin(
          'warehouse.branch',
          'branch',
          'branch.companyId = :companyId AND branch.status = :branchStatus',
          { companyId, branchStatus: BranchStatus.Active },
        )
        .select('stock.productVariantId', 'variantId')
        .addSelect(
          'SUM(GREATEST(0, stock.onHandQuantity - stock.reservedQuantity))',
          'quantityAvailable',
        )
        .where('stock.productVariantId IN (:...ids)', { ids })
        .groupBy('stock.productVariantId')
        .limit(VARIANT_LIMIT)
        .getRawMany<{ variantId: string; quantityAvailable: string }>();
      for (const row of rows) {
        const options = attributes.filter(
          (attribute) => attribute.variantId === row.id,
        );
        // Do not convert a partially hidden color/size combination into a different sellable variant.
        if (
          computeCombinationKey(options.map((option) => option.id)) !==
          row.combinationKey
        )
          continue;
        variants.push({
          id: row.id,
          sku: row.sku,
          unitPrice: row.unitPrice,
          quantityAvailable: Number(
            stock.find((balance) => balance.variantId === row.id)
              ?.quantityAvailable ?? 0,
          ),
          attributes: options.map(({ id, kind, value }) => ({
            id,
            kind,
            value,
          })),
        });
      }
    }
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      imageUrl: isPublicImageUrl(product.imageUrl) ? product.imageUrl : null,
      currency: product.currency,
      variants,
    };
  }
}
