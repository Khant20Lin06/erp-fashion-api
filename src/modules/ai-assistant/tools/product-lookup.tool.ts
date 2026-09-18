import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { ProductVariant } from '../../products/entities/product-variant.entity';
import { ProductVariantStatus } from '../../products/entities/product-variant-status.enum';
import { ProductVariantAttribute } from '../../products/entities/product-variant-attribute.entity';
import { AiTool, AiToolContext } from './ai-tool.interface';
import { ProductLookupArgsDto } from './dto/product-lookup-args.dto';
import { validateToolArguments } from './validate-tool-arguments';

const MAX_RESULTS = 10;

interface ProductLookupRow {
  productName: string;
  productCode: string;
  variantId: string;
  sku: string;
  sellingPrice: string;
  status: ProductVariantStatus;
  onHandQuantity: string;
}

export interface ProductLookupResult {
  name: string;
  sku: string;
  price: string;
  inStock: boolean;
  quantityAvailable: number;
  variant: string | null;
}

/**
 * Customer-safe product catalog search — deliberately its own tool rather
 * than reusing ProductsService/ProductVariantsService's admin-facing
 * findAll(), which returns costPrice and other internal-only fields.
 * Selects ONLY the columns a customer may see (name, SKU, sellingPrice,
 * stock availability) — costPrice/margin never leave the database query,
 * so there is no risk of the LLM being handed internal data it would then
 * have to be trusted not to repeat (docs/SECURITY_RULES.md #45 Sensitive
 * Data Minimization: select what's needed, not what's convenient).
 *
 * Matches by product name, product code, or variant SKU — the three ways
 * a customer or the LLM is likely to name an item in a chat message.
 */
@Injectable()
export class ProductLookupTool implements AiTool {
  readonly name = 'get_product_info';
  readonly description =
    'Search the product catalog for item name, SKU, price, and current stock availability. ' +
    'Use this whenever a customer asks about a specific product or item by name or SKU — "do you have X", "how much is X", "is X in stock", "what sizes/colors does X come in". ' +
    'Matches against product name, product code, and variant SKU (partial match). Returns up to 10 matching variants with their own price and stock status — never cost price or margin, which this tool does not expose. ' +
    'If no results are returned, say so honestly; do not guess a price or availability for an item this tool did not return.';
  readonly parameters = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Product name, product code, or SKU to search for (partial match).',
      },
      warehouseId: {
        type: 'string',
        format: 'uuid',
        description: 'Optional: check stock at one specific warehouse rather than summed across all.',
      },
    },
    required: ['query'],
  };
  readonly requiredPermission = 'products.read';
  readonly dataScopeResource = 'products';

  constructor(
    @InjectRepository(ProductVariant)
    private readonly variantRepository: Repository<ProductVariant>,
    @InjectRepository(ProductVariantAttribute)
    private readonly variantAttributeRepository: Repository<ProductVariantAttribute>,
  ) {}

  async execute(
    context: AiToolContext,
    rawArguments: unknown,
  ): Promise<ProductLookupResult[]> {
    const args = await validateToolArguments(ProductLookupArgsDto, rawArguments);

    const qb = this.variantRepository
      .createQueryBuilder('variant')
      .innerJoin('variant.product', 'product')
      .leftJoin(
        'warehouse_stock',
        'stock',
        'stock.product_variant_id = variant.id' +
          (args.warehouseId ? ' AND stock.warehouse_id = :warehouseId' : ''),
        args.warehouseId ? { warehouseId: args.warehouseId } : {},
      )
      .where('variant.companyId = :companyId', { companyId: context.companyId })
      .andWhere('variant.status = :status', {
        status: ProductVariantStatus.Active,
      })
      .andWhere(
        new Brackets((sub) => {
          sub
            .where('product.name LIKE :search', { search: `%${args.query}%` })
            .orWhere('product.code LIKE :search', { search: `%${args.query}%` })
            .orWhere('variant.sku LIKE :search', { search: `%${args.query}%` });
        }),
      )
      .groupBy('variant.id')
      .addGroupBy('product.name')
      .addGroupBy('product.code')
      .select([
        'product.name AS productName',
        'product.code AS productCode',
        'variant.id AS variantId',
        'variant.sku AS sku',
        'variant.sellingPrice AS sellingPrice',
        'variant.status AS status',
      ])
      .addSelect('COALESCE(SUM(stock.on_hand_quantity), 0)', 'onHandQuantity')
      .limit(MAX_RESULTS);

    const rows = await qb.getRawMany<ProductLookupRow>();

    if (rows.length === 0) {
      return [];
    }

    const variantIds = rows.map((row) => row.variantId);
    const attributeRows = await this.variantAttributeRepository.find({
      where: variantIds.map((variantId) => ({ variantId })),
      relations: { option: true },
    });
    const attributesByVariant = new Map<string, string[]>();
    for (const attr of attributeRows) {
      const label = attr.option?.value;
      if (!label) continue;
      const existing = attributesByVariant.get(attr.variantId) ?? [];
      existing.push(label);
      attributesByVariant.set(attr.variantId, existing);
    }

    return rows.map((row) => {
      const quantity = Number(row.onHandQuantity);
      const variantLabels = attributesByVariant.get(row.variantId);
      return {
        name: row.productName,
        sku: row.sku,
        price: row.sellingPrice,
        inStock: quantity > 0,
        quantityAvailable: quantity,
        variant: variantLabels && variantLabels.length > 0 ? variantLabels.join(', ') : null,
      };
    });
  }
}
