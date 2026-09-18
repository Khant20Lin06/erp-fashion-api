import { Repository } from 'typeorm';
import { OnlineOrdersService } from './online-orders.service';
import { OnlineOrder } from '../entities/online-order.entity';
import { OnlineOrderSource } from '../entities/online-order-source.enum';

const input = {
  companyId: 'co',
  saleId: 'sale',
  customerId: 'customer',
  source: OnlineOrderSource.Telegram,
  telegramUserId: '42',
  telegramUsername: null,
  deliveryAddress: 'Yangon',
};
describe('online order recovery', () => {
  it('replays an existing sale wrapper without another insert', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue({ id: 'order', ...input }),
      create: jest.fn(),
      save: jest.fn(),
    };
    const result = await new OnlineOrdersService(
      repo as unknown as Repository<OnlineOrder>,
    ).createForSale(input);
    expect(result.id).toBe('order');
    expect(repo.save).not.toHaveBeenCalled();
  });
  it('recovers a concurrent insert winner and rejects a mismatched delivery identity', async () => {
    const repo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValue({ id: 'winner', ...input }),
      create: jest.fn((x: unknown) => x),
      save: jest.fn().mockRejectedValue({ code: 'ER_DUP_ENTRY' }),
    };
    const service = new OnlineOrdersService(
      repo as unknown as Repository<OnlineOrder>,
    );
    expect((await service.createForSale(input)).id).toBe('winner');
    await expect(
      service.createForSale({ ...input, customerId: 'attacker' }),
    ).rejects.toBeDefined();
  });
});
