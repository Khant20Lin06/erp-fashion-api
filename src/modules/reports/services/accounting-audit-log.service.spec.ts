import { Repository } from 'typeorm';
import { AccountingAuditLogService } from './accounting-audit-log.service';
import { JournalEntry } from '../../accounting/entities/journal-entry.entity';
import { JournalEntryStatus } from '../../accounting/entities/journal-entry-status.enum';
import { Payment } from '../../payments/entities/payment.entity';
import { Sale } from '../../sales/entities/sale.entity';
import { SaleStatus } from '../../sales/entities/sale-status.enum';
import { PurchaseOrder } from '../../purchase/entities/purchase-order.entity';
import { PurchaseOrderStatus } from '../../purchase/entities/purchase-order-status.enum';

type MockQueryBuilder = Record<string, jest.Mock>;

function createMockQueryBuilder(rows: unknown[]): MockQueryBuilder {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(rows),
  };
}

describe('AccountingAuditLogService', () => {
  let service: AccountingAuditLogService;
  let journalEntryRepository: jest.Mocked<
    Pick<Repository<JournalEntry>, 'createQueryBuilder'>
  >;
  let paymentRepository: jest.Mocked<
    Pick<Repository<Payment>, 'createQueryBuilder'>
  >;
  let saleRepository: jest.Mocked<Pick<Repository<Sale>, 'createQueryBuilder'>>;
  let purchaseOrderRepository: jest.Mocked<
    Pick<Repository<PurchaseOrder>, 'createQueryBuilder'>
  >;

  function setup(rows: {
    journalEntries?: unknown[];
    payments?: unknown[];
    sales?: unknown[];
    purchaseOrders?: unknown[];
  }) {
    journalEntryRepository = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValue(createMockQueryBuilder(rows.journalEntries ?? [])),
    };
    paymentRepository = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValue(createMockQueryBuilder(rows.payments ?? [])),
    };
    saleRepository = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValue(createMockQueryBuilder(rows.sales ?? [])),
    };
    purchaseOrderRepository = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValue(createMockQueryBuilder(rows.purchaseOrders ?? [])),
    };
    service = new AccountingAuditLogService(
      journalEntryRepository as unknown as Repository<JournalEntry>,
      paymentRepository as unknown as Repository<Payment>,
      saleRepository as unknown as Repository<Sale>,
      purchaseOrderRepository as unknown as Repository<PurchaseOrder>,
    );
  }

  it('returns an empty, correctly-paginated result when nothing exists', async () => {
    setup({});

    const result = await service.query('company-a', {
      page: 1,
      limit: 20,
      skip: 0,
    });

    expect(result).toEqual({
      data: [],
      meta: { page: 1, limit: 20, total: 0 },
    });
  });

  it('emits one CREATED row for a DRAFT journal entry, and both CREATED+POSTED for a POSTED one', async () => {
    const createdAt = new Date('2026-08-01T10:00:00.000Z');
    const postedAt = new Date('2026-08-02T10:00:00.000Z');

    setup({
      journalEntries: [
        {
          id: 'je-draft',
          journalNumber: 'JE-0001',
          companyId: 'company-a',
          createdBy: 'user-1',
          createdAt,
          postedBy: null,
          postedAt: null,
          status: JournalEntryStatus.Draft,
        },
        {
          id: 'je-posted',
          journalNumber: 'JE-0002',
          companyId: 'company-a',
          createdBy: 'user-1',
          createdAt,
          postedBy: 'user-2',
          postedAt,
          status: JournalEntryStatus.Posted,
        },
      ],
    });

    const result = await service.query('company-a', {
      page: 1,
      limit: 20,
      skip: 0,
    });

    expect(result.meta.total).toBe(3);
    const draftRows = result.data.filter((row) => row.entityId === 'je-draft');
    const postedRows = result.data.filter(
      (row) => row.entityId === 'je-posted',
    );
    expect(draftRows).toEqual([
      expect.objectContaining({
        entityType: 'JOURNAL_ENTRY',
        action: 'CREATED',
        referenceNumber: 'JE-0001',
        performedBy: 'user-1',
        timestamp: createdAt,
      }),
    ]);
    // Sorted newest-first overall, so POSTED (Aug 2) precedes CREATED (Aug 1).
    expect(postedRows).toEqual([
      expect.objectContaining({
        entityType: 'JOURNAL_ENTRY',
        action: 'POSTED',
        referenceNumber: 'JE-0002',
        performedBy: 'user-2',
        timestamp: postedAt,
      }),
      expect.objectContaining({
        entityType: 'JOURNAL_ENTRY',
        action: 'CREATED',
        referenceNumber: 'JE-0002',
        performedBy: 'user-1',
        timestamp: createdAt,
      }),
    ]);
  });

  it('emits a CREATED row for a Payment using its real createdBy/createdAt', async () => {
    const createdAt = new Date('2026-08-03T10:00:00.000Z');
    setup({
      payments: [
        {
          id: 'pay-1',
          paymentNumber: 'PAY-0001',
          companyId: 'company-a',
          createdBy: 'user-3',
          createdAt,
        },
      ],
    });

    const result = await service.query('company-a', {
      page: 1,
      limit: 20,
      skip: 0,
    });

    expect(result.data).toEqual([
      expect.objectContaining({
        entityType: 'PAYMENT',
        entityId: 'pay-1',
        action: 'CREATED',
        referenceNumber: 'PAY-0001',
        performedBy: 'user-3',
        timestamp: createdAt,
      }),
    ]);
  });

  it('reports CONFIRMED (using updatedAt) for a confirmed Sale, CREATED (using createdAt) for a draft one', async () => {
    const createdAt = new Date('2026-08-04T09:00:00.000Z');
    const updatedAt = new Date('2026-08-04T11:00:00.000Z');
    setup({
      sales: [
        {
          id: 'sale-draft',
          saleNumber: 'SAL-0001',
          companyId: 'company-a',
          createdBy: 'user-4',
          createdAt,
          updatedAt,
          status: SaleStatus.Draft,
        },
        {
          id: 'sale-confirmed',
          saleNumber: 'SAL-0002',
          companyId: 'company-a',
          createdBy: 'user-4',
          createdAt,
          updatedAt,
          status: SaleStatus.Confirmed,
        },
      ],
    });

    const result = await service.query('company-a', {
      page: 1,
      limit: 20,
      skip: 0,
    });

    expect(result.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: 'sale-draft',
          action: 'CREATED',
          timestamp: createdAt,
        }),
        expect.objectContaining({
          entityId: 'sale-confirmed',
          action: 'CONFIRMED',
          timestamp: updatedAt,
        }),
      ]),
    );
  });

  it('reports CONFIRMED for a confirmed PurchaseOrder', async () => {
    const createdAt = new Date('2026-08-05T09:00:00.000Z');
    const updatedAt = new Date('2026-08-05T11:00:00.000Z');
    setup({
      purchaseOrders: [
        {
          id: 'po-confirmed',
          purchaseOrderNumber: 'PO-0001',
          companyId: 'company-a',
          createdBy: 'user-5',
          createdAt,
          updatedAt,
          status: PurchaseOrderStatus.Confirmed,
        },
      ],
    });

    const result = await service.query('company-a', {
      page: 1,
      limit: 20,
      skip: 0,
    });

    expect(result.data).toEqual([
      expect.objectContaining({
        entityType: 'PURCHASE_ORDER',
        entityId: 'po-confirmed',
        action: 'CONFIRMED',
        referenceNumber: 'PO-0001',
        timestamp: updatedAt,
      }),
    ]);
  });

  it('sorts the merged feed newest-first across all four entity types', async () => {
    setup({
      journalEntries: [
        {
          id: 'je-1',
          journalNumber: 'JE-0001',
          companyId: 'company-a',
          createdBy: 'u1',
          createdAt: new Date('2026-08-01T00:00:00.000Z'),
          postedBy: null,
          postedAt: null,
          status: JournalEntryStatus.Draft,
        },
      ],
      payments: [
        {
          id: 'pay-1',
          paymentNumber: 'PAY-0001',
          companyId: 'company-a',
          createdBy: 'u2',
          createdAt: new Date('2026-08-03T00:00:00.000Z'),
        },
      ],
      sales: [
        {
          id: 'sale-1',
          saleNumber: 'SAL-0001',
          companyId: 'company-a',
          createdBy: 'u3',
          createdAt: new Date('2026-08-02T00:00:00.000Z'),
          updatedAt: new Date('2026-08-02T00:00:00.000Z'),
          status: SaleStatus.Draft,
        },
      ],
    });

    const result = await service.query('company-a', {
      page: 1,
      limit: 20,
      skip: 0,
    });

    expect(result.data.map((row) => row.entityId)).toEqual([
      'pay-1',
      'sale-1',
      'je-1',
    ]);
  });

  it('applies branchId filter to every underlying query when provided', async () => {
    setup({});

    await service.query('company-a', {
      branchId: 'branch-1',
      page: 1,
      limit: 20,
      skip: 0,
    });

    for (const repo of [
      journalEntryRepository,
      paymentRepository,
      saleRepository,
      purchaseOrderRepository,
    ]) {
      const qb = repo.createQueryBuilder.mock.results[0]
        .value as MockQueryBuilder;
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('.branchId = :branchId'),
        { branchId: 'branch-1' },
      );
    }
  });

  it('paginates the merged, sorted result rather than each source query independently', async () => {
    const payments = Array.from({ length: 5 }, (_, i) => ({
      id: `pay-${i}`,
      paymentNumber: `PAY-000${i}`,
      companyId: 'company-a',
      createdBy: 'u1',
      createdAt: new Date(Date.UTC(2026, 7, i + 1)),
    }));
    setup({ payments });

    const result = await service.query('company-a', {
      page: 2,
      limit: 2,
      skip: 2,
    });

    expect(result.meta).toEqual({ page: 2, limit: 2, total: 5 });
    expect(result.data).toHaveLength(2);
    // newest-first overall: pay-4, pay-3, pay-2, pay-1, pay-0 -> page 2 = [pay-2, pay-1]
    expect(result.data.map((row) => row.entityId)).toEqual(['pay-2', 'pay-1']);
  });
});
