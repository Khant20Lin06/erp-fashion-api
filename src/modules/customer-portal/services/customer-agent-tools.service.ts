import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { OnlineOrder } from '../../online-orders/entities/online-order.entity';
import { CustomerAgentToolDto } from '../dto/customer-agent-tool.dto';
import { CustomerCatalogService } from './customer-catalog.service';
import { CustomerPortalService } from './customer-portal.service';
import { ShoppingStateService } from './shopping-state.service';
import { CatalogDiscoveryQueryDto } from '../dto/catalog.dto';

@Injectable()
export class CustomerAgentToolsService {
  constructor(
    private readonly shopping: ShoppingStateService,
    private readonly catalog: CustomerCatalogService,
    private readonly portal: CustomerPortalService,
    private readonly source: DataSource,
    private readonly config: ConfigService,
  ) {}

  async call(botUserId: string, input: CustomerAgentToolDto): Promise<unknown> {
    const scope = await this.shopping.authorizeAgentTool(botUserId, input);
    if (input.tool === 'search' || input.tool === 'popular') {
      const filters: CatalogDiscoveryQueryDto = { query: input.query || '' };
      if (
        input.tool === 'popular' &&
        typeof scope.preferences.family === 'string'
      )
        filters.query = scope.preferences.family;
      for (const key of ['size', 'color', 'maxPrice', 'currency'] as const) {
        const value = scope.preferences[key];
        if (typeof value === 'string') filters[key] = value;
      }
      return input.tool === 'popular'
        ? this.catalog.popular(input.companyId, filters)
        : this.catalog.discover(input.companyId, filters);
    }
    if (input.tool === 'detail') {
      if (!input.productId)
        throw new BadRequestException('productId is required');
      return this.catalog.detail(input.companyId, input.productId);
    }
    if (input.tool === 'policy') return this.publicPolicies(input.companyId);
    if (input.tool === 'orders') {
      const customer = await this.portal.getLinkedCustomerOrThrow(scope.userId);
      if (customer.companyId !== input.companyId)
        throw new ForbiddenException('Customer company mismatch');
      // A small explicit projection: no addresses, phone numbers, staff notes,
      // accounting fields, or arbitrary customer IDs are available to the model.
      const orders = await this.source
        .getRepository(OnlineOrder)
        .createQueryBuilder('o')
        .innerJoin('o.sale', 'sale', 'sale.companyId = :companyId', {
          companyId: input.companyId,
        })
        .select('sale.saleNumber', 'orderNumber')
        .addSelect('o.status', 'status')
        .addSelect('o.statusUpdatedAt', 'statusUpdatedAt')
        .addSelect('o.createdAt', 'createdAt')
        .where('o.companyId = :companyId', { companyId: input.companyId })
        .andWhere('o.customerId = :customerId', { customerId: customer.id })
        .andWhere('o.telegramUserId = :userId', { userId: scope.userId })
        .orderBy('o.createdAt', 'DESC')
        .limit(5)
        .getRawMany();
      return { orders };
    }
    throw new BadRequestException('Unknown customer tool');
  }

  private publicPolicies(companyId: string) {
    const raw = this.config.get<string>('CUSTOMER_BOT_PUBLIC_POLICIES');
    if (!raw) return { available: false, policies: [] };
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new BadRequestException('Invalid public policy configuration');
    }
    const entries: unknown =
      data && typeof data === 'object'
        ? (data as Record<string, unknown>)[companyId]
        : undefined;
    const policies = (Array.isArray(entries) ? entries : [])
      .slice(0, 12)
      .filter(
        (p: unknown): p is { topic: string; text: string } =>
          !!p &&
          typeof p === 'object' &&
          typeof (p as { topic?: unknown }).topic === 'string' &&
          typeof (p as { text?: unknown }).text === 'string',
      )
      .map((p) => ({
        topic: p.topic.slice(0, 80),
        text: p.text.slice(0, 1500),
      }));
    return { available: policies.length > 0, policies };
  }
}
