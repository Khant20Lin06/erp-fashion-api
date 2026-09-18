import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EcommerceChannel } from '../entities/ecommerce-channel.entity';
import { EcommerceChannelStatus } from '../entities/ecommerce-channel-status.enum';
import { ProductVariant } from '../../products/entities/product-variant.entity';
import { ProductVariantStatus } from '../../products/entities/product-variant-status.enum';
import { ProductVariantAttribute } from '../../products/entities/product-variant-attribute.entity';
import { WarehouseStock } from '../../inventory/entities/warehouse-stock.entity';
import { SyncChannelOrderDto, UpdateChannelDto } from '../dto/sync-channel-order.dto';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';

const DEFAULT_CHANNELS = [
  { code: 'TIKTOK', name: 'TikTok Shop' },
  { code: 'FACEBOOK', name: 'Facebook & Instagram Shop' },
  { code: 'TELEGRAM', name: 'Telegram Order Bot' },
  { code: 'CUSTOM_WEBHOOK', name: 'Custom E-Commerce API' },
];

@Injectable()
export class ChannelsService {
  constructor(
    @InjectRepository(EcommerceChannel)
    private readonly channelRepository: Repository<EcommerceChannel>,
    @InjectRepository(ProductVariant)
    private readonly productVariantRepository: Repository<ProductVariant>,
    @InjectRepository(ProductVariantAttribute)
    private readonly productVariantAttributeRepository: Repository<ProductVariantAttribute>,
    @InjectRepository(WarehouseStock)
    private readonly warehouseStockRepository: Repository<WarehouseStock>,
  ) {}

  async getChannels(companyId: string): Promise<EcommerceChannel[]> {
    let channels = await this.channelRepository.find({
      where: { companyId },
      order: { createdAt: 'ASC' },
    });

    if (channels.length === 0) {
      // Seed default channels for this company
      for (const def of DEFAULT_CHANNELS) {
        const chan = this.channelRepository.create({
          companyId,
          code: def.code,
          name: def.name,
          status: EcommerceChannelStatus.Active,
          stockBuffer: 2,
          syncedOrdersCount: 0,
        });
        await this.channelRepository.save(chan);
      }
      channels = await this.channelRepository.find({
        where: { companyId },
        order: { createdAt: 'ASC' },
      });
    }

    return channels;
  }

  async getChannelById(id: string, companyId: string): Promise<EcommerceChannel> {
    const channel = await this.channelRepository.findOne({
      where: { id, companyId },
    });
    if (!channel) {
      throw new AppException(ErrorCode.NotFound, 'Ecommerce channel not found');
    }
    return channel;
  }

  async updateChannel(
    id: string,
    companyId: string,
    dto: UpdateChannelDto,
  ): Promise<EcommerceChannel> {
    const channel = await this.getChannelById(id, companyId);

    if (dto.status !== undefined) {
      channel.status = dto.status as EcommerceChannelStatus;
    }
    if (dto.apiKey !== undefined) {
      channel.apiKey = dto.apiKey;
    }
    if (dto.webhookSecret !== undefined) {
      channel.webhookSecret = dto.webhookSecret;
    }
    if (dto.stockBuffer !== undefined) {
      channel.stockBuffer = dto.stockBuffer;
    }

    return this.channelRepository.save(channel);
  }

  async triggerSync(id: string, companyId: string): Promise<EcommerceChannel> {
    const channel = await this.getChannelById(id, companyId);
    channel.lastSyncedAt = new Date();
    return this.channelRepository.save(channel);
  }

  async ingestOrder(
    companyId: string,
    dto: SyncChannelOrderDto,
  ): Promise<{ success: boolean; message: string; orderId: string }> {
    const channel = await this.channelRepository.findOne({
      where: { companyId, code: dto.channelCode },
    });

    if (channel) {
      channel.syncedOrdersCount += 1;
      channel.lastSyncedAt = new Date();
      await this.channelRepository.save(channel);
    }

    return {
      success: true,
      message: `Order ${dto.externalOrderId} synced successfully from ${dto.channelCode}`,
      orderId: dto.externalOrderId,
    };
  }

  async generateCatalogFeed(
    companyId: string,
    channelCode?: string,
  ): Promise<{
    feedVersion: string;
    generatedAt: string;
    channel: string;
    totalProducts: number;
    items: any[];
  }> {
    const channel = channelCode
      ? await this.channelRepository.findOne({
          where: { companyId, code: channelCode },
        })
      : null;

    const buffer = channel?.stockBuffer ?? 0;

    // Load active variants with product and brand
    const variants = await this.productVariantRepository.find({
      where: { companyId, status: ProductVariantStatus.Active },
      relations: { product: { brand: true, category: true } },
    });

    const variantIds = variants.map((v) => v.id);

    const [attributes, stockRows] = await Promise.all([
      variantIds.length > 0
        ? this.productVariantAttributeRepository.find({
            where: { variantId: In(variantIds) },
            relations: { option: true },
          })
        : Promise.resolve([]),
      variantIds.length > 0
        ? this.warehouseStockRepository.find({
            where: { productVariantId: In(variantIds) },
          })
        : Promise.resolve([]),
    ]);

    // Aggregate stock by variant
    const stockMap = new Map<string, number>();
    for (const row of stockRows) {
      const current = stockMap.get(row.productVariantId) ?? 0;
      stockMap.set(row.productVariantId, current + row.onHandQuantity);
    }

    const feedItems = variants.map((variant) => {
      const totalStock = stockMap.get(variant.id) ?? 0;
      const availableStock = Math.max(0, totalStock - buffer);

      const variantAttrs = attributes.filter((a) => a.variantId === variant.id);
      const colorAttr = variantAttrs.find((a) => a.kind?.toLowerCase() === 'color')?.option?.value;
      const sizeAttr = variantAttrs.find((a) => a.kind?.toLowerCase() === 'size')?.option?.value;
      const variantDesc = variantAttrs.map((a) => a.option?.value).filter(Boolean).join(' / ');

      const title = variantDesc
        ? `${variant.product?.name ?? 'Product'} - ${variantDesc}`
        : (variant.product?.name ?? 'Product');

      return {
        id: variant.id,
        item_group_id: variant.productId,
        title,
        description: variant.product?.description || title,
        availability: availableStock > 0 ? 'in stock' : 'out of stock',
        inventory: availableStock,
        price: `${variant.sellingPrice} MMK`,
        sale_price: `${variant.sellingPrice} MMK`,
        brand: variant.product?.brand?.name ?? 'Fashion Boutique',
        category: variant.product?.category?.name ?? 'Apparel',
        sku: variant.sku,
        barcode: variant.sku,
        color: colorAttr ?? null,
        size: sizeAttr ?? null,
        condition: 'new',
        link: `https://shop.fashionerp.com/products/${variant.productId}?variant=${variant.id}`,
        image_link: variant.product?.imageUrl ?? null,
      };
    });

    return {
      feedVersion: '2.0',
      generatedAt: new Date().toISOString(),
      channel: channelCode ?? 'ALL',
      totalProducts: feedItems.length,
      items: feedItems,
    };
  }
}
