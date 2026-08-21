import { EntityManager, Repository } from 'typeorm';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyPointTransaction } from '../entities/loyalty-point-transaction.entity';
import { LoyaltyPointTransactionType } from '../entities/loyalty-point-transaction-type.enum';
import { LoyaltyProgramService } from './loyalty-program.service';
import { CustomersService } from '../../customer-supplier/services/customers.service';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { ErrorCode } from '../../../core/errors/error-codes';

describe('LoyaltyService', () => {
  let service: LoyaltyService;
  let transactionRepository: jest.Mocked<
    Pick<
      Repository<LoyaltyPointTransaction>,
      'findAndCount' | 'createQueryBuilder'
    >
  >;
  let loyaltyProgramService: jest.Mocked<
    Pick<LoyaltyProgramService, 'getActiveProgramOrNull'>
  >;
  let customersService: jest.Mocked<
    Pick<CustomersService, 'findByIdInCompany'>
  >;
  let transactionService: jest.Mocked<Pick<TransactionService, 'run'>>;

  interface MockManager {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    getRepository: jest.Mock;
  }
  let manager: MockManager;
  let balanceQueryBuilder: {
    select: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    getRawOne: jest.Mock;
  };
  let lockQueryBuilder: {
    where: jest.Mock;
    andWhere: jest.Mock;
    setLock: jest.Mock;
    getMany: jest.Mock;
  };

  const buildProgram = (overrides: Record<string, unknown> = {}) =>
    ({
      companyId: 'company-a',
      pointsPerCurrencyUnit: '0.0100',
      redemptionValuePerPoint: '1.0000',
      minimumPurchaseForEarning: '0.00',
      isActive: true,
      ...overrides,
    }) as never;

  beforeEach(() => {
    transactionRepository = {
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      createQueryBuilder: jest.fn(),
    };
    loyaltyProgramService = {
      getActiveProgramOrNull: jest.fn().mockResolvedValue(buildProgram()),
    };
    customersService = {
      findByIdInCompany: jest.fn().mockResolvedValue({ id: 'cust-1' }),
    };

    balanceQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ balance: '0' }),
    };
    transactionRepository.createQueryBuilder.mockReturnValue(
      balanceQueryBuilder as never,
    );
    lockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    manager = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((_entity: unknown, data: unknown) => data),
      save: jest.fn((_entity: unknown, data: unknown) => Promise.resolve(data)),
      getRepository: jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(balanceQueryBuilder),
      }),
    };
    (
      manager as unknown as { createQueryBuilder: jest.Mock }
    ).createQueryBuilder = jest.fn().mockReturnValue(lockQueryBuilder);

    transactionService = {
      run: jest
        .fn()
        .mockImplementation((work: (m: EntityManager) => Promise<unknown>) =>
          work(manager as unknown as EntityManager),
        ),
    };

    service = new LoyaltyService(
      transactionRepository as unknown as Repository<LoyaltyPointTransaction>,
      loyaltyProgramService as unknown as LoyaltyProgramService,
      customersService as unknown as CustomersService,
      transactionService as unknown as TransactionService,
    );
  });

  describe('earnForSale', () => {
    it('earns points computed from grandTotal * pointsPerCurrencyUnit, floored', async () => {
      const result = await service.earnForSale(
        manager as unknown as EntityManager,
        'company-a',
        'cust-1',
        'sale-1',
        '199.00',
        'user-1',
      );
      // 199 * 0.01 = 1.99 -> floor -> 1
      expect(result?.pointsDelta).toBe(1);
      expect(result?.type).toBe(LoyaltyPointTransactionType.Earn);
      expect(result?.sourceType).toBe('SALE');
      expect(result?.sourceId).toBe('sale-1');
    });

    it('does not create a duplicate EARN transaction for the same sale (idempotent)', async () => {
      const existing = { id: 'tx-existing', pointsDelta: 5 };
      manager.findOne.mockResolvedValue(existing);

      const result = await service.earnForSale(
        manager as unknown as EntityManager,
        'company-a',
        'cust-1',
        'sale-1',
        '500.00',
        'user-1',
      );

      expect(result).toBe(existing);
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('returns null when no active loyalty program is configured', async () => {
      loyaltyProgramService.getActiveProgramOrNull.mockResolvedValue(null);

      const result = await service.earnForSale(
        manager as unknown as EntityManager,
        'company-a',
        'cust-1',
        'sale-1',
        '500.00',
        'user-1',
      );
      expect(result).toBeNull();
    });

    it('returns null when grandTotal is below minimumPurchaseForEarning', async () => {
      loyaltyProgramService.getActiveProgramOrNull.mockResolvedValue(
        buildProgram({ minimumPurchaseForEarning: '1000.00' }),
      );

      const result = await service.earnForSale(
        manager as unknown as EntityManager,
        'company-a',
        'cust-1',
        'sale-1',
        '500.00',
        'user-1',
      );
      expect(result).toBeNull();
    });
  });

  describe('reverseForSaleReturn', () => {
    it('creates a REVERSAL transaction with negative pointsDelta pointing at the original EARN', async () => {
      manager.findOne.mockImplementation((entity: unknown, opts: unknown) => {
        const where = (opts as { where: { sourceType?: string } })?.where;
        if (where?.sourceType === 'SALE') {
          return Promise.resolve({ id: 'earn-tx-1', pointsDelta: 10 });
        }
        return Promise.resolve(null);
      });

      const result = await service.reverseForSaleReturn(
        manager as unknown as EntityManager,
        'company-a',
        'cust-1',
        'sale-1',
        'return-1',
        4,
        'user-1',
      );

      expect(result?.type).toBe(LoyaltyPointTransactionType.Reversal);
      expect(result?.pointsDelta).toBe(-4);
      expect(result?.reversesTransactionId).toBe('earn-tx-1');
    });

    it('no-ops when the original sale never earned points', async () => {
      manager.findOne.mockResolvedValue(null);

      const result = await service.reverseForSaleReturn(
        manager as unknown as EntityManager,
        'company-a',
        'cust-1',
        'sale-1',
        'return-1',
        4,
        'user-1',
      );
      expect(result).toBeNull();
      expect(manager.save).not.toHaveBeenCalled();
    });
  });

  describe('redeem — insufficient points and concurrency protection', () => {
    it('redeems successfully when sufficient points are available', async () => {
      balanceQueryBuilder.getRawOne.mockResolvedValue({ balance: '100' });

      const result = await service.redeem(
        manager as unknown as EntityManager,
        'company-a',
        'cust-1',
        'user-1',
        { points: 50 },
      );

      expect(result.pointsDelta).toBe(-50);
      expect(result.type).toBe(LoyaltyPointTransactionType.Redeem);
      expect(result.redemptionValue).toBe('50.00');
      // concurrency lock acquired before computing balance
      expect(lockQueryBuilder.setLock).toHaveBeenCalledWith(
        'pessimistic_write',
      );
    });

    it('rejects redemption when requested points exceed available balance', async () => {
      balanceQueryBuilder.getRawOne.mockResolvedValue({ balance: '10' });

      await expect(
        service.redeem(
          manager as unknown as EntityManager,
          'company-a',
          'cust-1',
          'user-1',
          { points: 50 },
        ),
      ).rejects.toMatchObject({ errorCode: ErrorCode.UnprocessableEntity });
    });

    it('rejects redemption when no active loyalty program is configured', async () => {
      loyaltyProgramService.getActiveProgramOrNull.mockResolvedValue(null);

      await expect(
        service.redeem(
          manager as unknown as EntityManager,
          'company-a',
          'cust-1',
          'user-1',
          { points: 10 },
        ),
      ).rejects.toMatchObject({ errorCode: ErrorCode.UnprocessableEntity });
    });
  });

  describe('getAvailableBalance', () => {
    it('derives balance from SUM(pointsDelta), never a mutable counter', async () => {
      balanceQueryBuilder.getRawOne.mockResolvedValue({ balance: '42' });

      const balance = await service.getAvailableBalance('company-a', 'cust-1');
      expect(balance).toBe(42);
    });
  });
});
