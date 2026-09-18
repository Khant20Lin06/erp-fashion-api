import { Repository } from 'typeorm';
import { OnlineOrdersService } from './online-orders.service';
import { OnlineOrder } from '../entities/online-order.entity';
import { OnlineOrderStatus } from '../entities/online-order-status.enum';
import { OnlineOrderSource } from '../entities/online-order-source.enum';
import { ListOnlineOrdersDto } from '../dto/online-orders.dto';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('OnlineOrdersService', () => {
  let service: OnlineOrdersService;
  let repository: jest.Mocked<
    Pick<Repository<OnlineOrder>, 'findAndCount' | 'findOne' | 'create' | 'save'>
  >;

  const buildOrder = (overrides: Partial<OnlineOrder> = {}): OnlineOrder =>
    ({
      id: 'order-1',
      companyId: 'company-1',
      saleId: 'sale-1',
      customerId: 'customer-1',
      source: OnlineOrderSource.Telegram,
      status: OnlineOrderStatus.PendingReview,
      telegramUserId: 'tg-1',
      telegramUsername: null,
      deliveryAddress: '123 Main St',
      statusUpdatedAt: null,
      ...overrides,
    }) as OnlineOrder;

  beforeEach(() => {
    repository = {
      findAndCount: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    repository.create.mockImplementation((input) => input as OnlineOrder);
    repository.save.mockImplementation((input) =>
      Promise.resolve(input as OnlineOrder),
    );

    service = new OnlineOrdersService(
      repository as unknown as Repository<OnlineOrder>,
    );
  });

  describe('findAll', () => {
    it('scopes the query to the given companyId and applies pagination defaults', async () => {
      repository.findAndCount.mockResolvedValue([[buildOrder()], 1]);

      const result = await service.findAll(
        'company-1',
        {} as ListOnlineOrdersDto,
      );

      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'company-1' },
        }),
      );
      expect(result.meta.total).toBe(1);
    });

    it('filters by source and status when provided', async () => {
      repository.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll('company-1', {
        source: OnlineOrderSource.Telegram,
        status: OnlineOrderStatus.Confirmed,
      } as ListOnlineOrdersDto);

      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            companyId: 'company-1',
            source: OnlineOrderSource.Telegram,
            status: OnlineOrderStatus.Confirmed,
          },
        }),
      );
    });
  });

  describe('findByIdInCompany', () => {
    it('returns the order when found within the company', async () => {
      const order = buildOrder();
      repository.findOne.mockResolvedValue(order);

      await expect(
        service.findByIdInCompany('order-1', 'company-1'),
      ).resolves.toBe(order);
    });

    it('throws NotFound when no matching order exists', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.findByIdInCompany('missing', 'company-1'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });
  });

  describe('createForSale', () => {
    it('creates and saves a new OnlineOrder in PENDING_REVIEW status', async () => {
      const result = await service.createForSale({
        companyId: 'company-1',
        saleId: 'sale-1',
        customerId: 'customer-1',
        source: OnlineOrderSource.Telegram,
        telegramUserId: 'tg-1',
        telegramUsername: 'shopper1',
        deliveryAddress: '123 Main St',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 'company-1',
          saleId: 'sale-1',
          customerId: 'customer-1',
          status: OnlineOrderStatus.PendingReview,
          deliveryAddress: '123 Main St',
        }),
      );
      expect(repository.save).toHaveBeenCalled();
      expect(result.status).toBe(OnlineOrderStatus.PendingReview);
    });
  });

  describe('updateStatus', () => {
    it('allows a valid forward transition and stamps statusUpdatedAt', async () => {
      const order = buildOrder({ status: OnlineOrderStatus.PendingReview });
      repository.findOne.mockResolvedValue(order);

      const result = await service.updateStatus(
        'order-1',
        'company-1',
        OnlineOrderStatus.Confirmed,
      );

      expect(result.status).toBe(OnlineOrderStatus.Confirmed);
      expect(result.statusUpdatedAt).toBeInstanceOf(Date);
      expect(repository.save).toHaveBeenCalled();
    });

    it('rejects a transition not in the allowed set', async () => {
      const order = buildOrder({ status: OnlineOrderStatus.PendingReview });
      repository.findOne.mockResolvedValue(order);

      await expect(
        service.updateStatus('order-1', 'company-1', OnlineOrderStatus.Delivered),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('rejects any transition out of a terminal status (DELIVERED)', async () => {
      const order = buildOrder({ status: OnlineOrderStatus.Delivered });
      repository.findOne.mockResolvedValue(order);

      await expect(
        service.updateStatus('order-1', 'company-1', OnlineOrderStatus.Cancelled),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('rejects any transition out of a terminal status (CANCELLED)', async () => {
      const order = buildOrder({ status: OnlineOrderStatus.Cancelled });
      repository.findOne.mockResolvedValue(order);

      await expect(
        service.updateStatus('order-1', 'company-1', OnlineOrderStatus.Confirmed),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('does not allow cancelling once ON_MY_WAY', async () => {
      const order = buildOrder({ status: OnlineOrderStatus.OnMyWay });
      repository.findOne.mockResolvedValue(order);

      await expect(
        service.updateStatus('order-1', 'company-1', OnlineOrderStatus.Cancelled),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });
  });
});
