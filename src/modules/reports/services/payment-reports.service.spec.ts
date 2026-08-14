import { Repository } from 'typeorm';
import { PaymentReportsService } from './payment-reports.service';
import { Payment } from '../../payments/entities/payment.entity';
import { PaymentStatus } from '../../payments/entities/payment-status.enum';
import { PaymentDirection } from '../../payments/entities/payment-direction.enum';

describe('PaymentReportsService', () => {
  let service: PaymentReportsService;
  let paymentRepository: jest.Mocked<
    Pick<Repository<Payment>, 'createQueryBuilder'>
  >;
  let queryBuilder: Record<string, jest.Mock>;

  beforeEach(() => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    paymentRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    service = new PaymentReportsService(
      paymentRepository as unknown as Repository<Payment>,
    );
  });

  it('filters to CONFIRMED payments only', async () => {
    await service.byDate('company-a', {});

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'payment.status = :status',
      { status: PaymentStatus.Confirmed },
    );
  });

  it('applies branchId/fromDate/toDate filters when provided', async () => {
    await service.byDate('company-a', {
      branchId: 'branch-1',
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
    });

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'payment.branchId = :branchId',
      { branchId: 'branch-1' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'payment.paymentDate >= :fromDate',
      { fromDate: '2026-01-01' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'payment.paymentDate <= :toDate',
      { toDate: '2026-01-31' },
    );
  });

  it('applies allowedBranchIds when branchId is not provided', async () => {
    await service.byDate('company-a', {
      allowedBranchIds: ['branch-1', 'branch-2'],
    });

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'payment.branchId IN (:...allowedBranchIds)',
      { allowedBranchIds: ['branch-1', 'branch-2'] },
    );
  });

  it('byDate groups by DATE(paymentDate)', async () => {
    queryBuilder.getRawMany.mockResolvedValue([
      { date: '2026-08-01', paymentCount: '3', totalAmount: '450.00' },
    ]);

    const result = await service.byDate('company-a', {});

    expect(queryBuilder.groupBy).toHaveBeenCalledWith(
      'DATE(payment.paymentDate)',
    );
    expect(result).toEqual([
      { date: '2026-08-01', paymentCount: 3, totalAmount: '450.00' },
    ]);
  });

  it('byDirection groups by direction (RECEIPT/PAYMENT)', async () => {
    queryBuilder.getRawMany.mockResolvedValue([
      {
        direction: PaymentDirection.Receipt,
        paymentCount: '5',
        totalAmount: '1000.00',
      },
      {
        direction: PaymentDirection.Payment,
        paymentCount: '2',
        totalAmount: '300.00',
      },
    ]);

    const result = await service.byDirection('company-a', {});

    expect(queryBuilder.groupBy).toHaveBeenCalledWith('payment.direction');
    expect(result).toEqual([
      {
        direction: PaymentDirection.Receipt,
        paymentCount: 5,
        totalAmount: '1000.00',
      },
      {
        direction: PaymentDirection.Payment,
        paymentCount: 2,
        totalAmount: '300.00',
      },
    ]);
  });

  it('byMethod joins paymentMethod and groups by method identity', async () => {
    queryBuilder.getRawMany.mockResolvedValue([
      {
        paymentMethodId: 'pm-1',
        paymentMethodCode: 'CASH',
        paymentMethodName: 'Cash',
        paymentCount: '10',
        totalAmount: '2000.00',
      },
    ]);

    const result = await service.byMethod('company-a', {});

    expect(queryBuilder.innerJoin).toHaveBeenCalledWith(
      'payment.paymentMethod',
      'paymentMethod',
    );
    expect(result[0].paymentMethodCode).toBe('CASH');
  });
});
