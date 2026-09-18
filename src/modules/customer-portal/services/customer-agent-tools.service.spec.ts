import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { CustomerAgentToolsService } from './customer-agent-tools.service';
import { CustomerCatalogService } from './customer-catalog.service';
import { CustomerPortalService } from './customer-portal.service';
import { ShoppingStateService } from './shopping-state.service';

describe('customer agent read tools', () => {
  const input = {
    companyId: 'company-1',
    update: {},
    operationToken: 'token',
    tool: 'search' as const,
    query: 'shirts',
  };
  const catalog = { discover: jest.fn(), detail: jest.fn() };
  const shopping = { authorizeAgentTool: jest.fn() };
  const portal = { getLinkedCustomerOrThrow: jest.fn() };
  const qb: Record<string, jest.Mock> = {};
  for (const method of [
    'innerJoin',
    'select',
    'addSelect',
    'where',
    'andWhere',
    'orderBy',
    'limit',
  ])
    qb[method] = jest.fn(() => qb);
  qb.getRawMany = jest.fn();
  const source = {
    getRepository: jest.fn(() => ({ createQueryBuilder: () => qb })),
  };
  const config = { get: jest.fn() };
  const service = new CustomerAgentToolsService(
    shopping as unknown as ShoppingStateService,
    catalog as unknown as CustomerCatalogService,
    portal as unknown as CustomerPortalService,
    source as unknown as DataSource,
    config as unknown as ConfigService,
  );
  beforeEach(() => {
    jest.clearAllMocks();
    shopping.authorizeAgentTool.mockResolvedValue({
      userId: '42',
      preferences: { size: 'M' },
    });
    catalog.discover.mockResolvedValue({ products: [] });
    config.get.mockReturnValue(undefined);
  });
  it('authorizes the operation before any catalog read and preserves hard preferences', async () => {
    await service.call('bot-1', input);
    expect(shopping.authorizeAgentTool).toHaveBeenCalledWith('bot-1', input);
    expect(catalog.discover).toHaveBeenCalledWith(
      'company-1',
      expect.objectContaining({ query: 'shirts', size: 'M' }),
    );
    shopping.authorizeAgentTool.mockRejectedValueOnce(
      new Error('stale operation'),
    );
    await expect(service.call('bot-1', input)).rejects.toThrow('stale');
    expect(catalog.discover).toHaveBeenCalledTimes(1);
  });
  it('does not invent policies when no public company policy is configured', async () => {
    expect(await service.call('bot-1', { ...input, tool: 'policy' })).toEqual({
      available: false,
      policies: [],
    });
    config.get.mockReturnValue(
      JSON.stringify({
        'company-2': [{ topic: 'private', text: 'other tenant' }],
      }),
    );
    expect(await service.call('bot-1', { ...input, tool: 'policy' })).toEqual({
      available: false,
      policies: [],
    });
  });
  it('orders constrain company, linked customer and Telegram sender and omit addresses', async () => {
    portal.getLinkedCustomerOrThrow.mockResolvedValue({
      id: 'customer-1',
      companyId: 'company-1',
    });
    qb.getRawMany.mockResolvedValue([]);
    await service.call('bot-1', { ...input, tool: 'orders' });
    expect(qb.where).toHaveBeenCalledWith('o.companyId = :companyId', {
      companyId: 'company-1',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('o.customerId = :customerId', {
      customerId: 'customer-1',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('o.telegramUserId = :userId', {
      userId: '42',
    });
    expect(
      JSON.stringify(qb.select.mock.calls) +
        JSON.stringify(qb.addSelect.mock.calls),
    ).not.toContain('deliveryAddress');
    portal.getLinkedCustomerOrThrow.mockResolvedValueOnce({
      id: 'customer-2',
      companyId: 'company-2',
    });
    await expect(
      service.call('bot-1', { ...input, tool: 'orders' }),
    ).rejects.toThrow();
  });
});
