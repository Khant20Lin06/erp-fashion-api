import { Repository } from 'typeorm';
import { ArApAgingService } from './ar-ap-aging.service';
import { JournalEntryLine } from '../../accounting/entities/journal-entry-line.entity';
import { Customer } from '../../customer-supplier/entities/customer.entity';
import { Supplier } from '../../customer-supplier/entities/supplier.entity';
import { CustomerStatus } from '../../customer-supplier/entities/customer-status.enum';
import { SupplierStatus } from '../../customer-supplier/entities/supplier-status.enum';

describe('ArApAgingService', () => {
  let service: ArApAgingService;
  let lineRepository: jest.Mocked<
    Pick<Repository<JournalEntryLine>, 'createQueryBuilder'>
  >;
  let customerRepository: jest.Mocked<Pick<Repository<Customer>, 'find'>>;
  let supplierRepository: jest.Mocked<Pick<Repository<Supplier>, 'find'>>;
  let queryBuilder: Record<string, jest.Mock>;

  const buildCustomer = (overrides: Partial<Customer> = {}): Customer =>
    ({
      id: 'cust-1',
      companyId: 'company-a',
      customerCode: 'CUST-1',
      name: 'Acme',
      receivableAccountId: 'ar-account-1',
      status: CustomerStatus.Active,
      ...overrides,
    }) as Customer;

  const buildSupplier = (overrides: Partial<Supplier> = {}): Supplier =>
    ({
      id: 'sup-1',
      companyId: 'company-a',
      supplierCode: 'SUP-1',
      name: 'Widgets Inc',
      payableAccountId: 'ap-account-1',
      status: SupplierStatus.Active,
      ...overrides,
    }) as Supplier;

  beforeEach(() => {
    queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    lineRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    customerRepository = { find: jest.fn().mockResolvedValue([]) };
    supplierRepository = { find: jest.fn().mockResolvedValue([]) };

    service = new ArApAgingService(
      lineRepository as unknown as Repository<JournalEntryLine>,
      customerRepository as unknown as Repository<Customer>,
      supplierRepository as unknown as Repository<Supplier>,
    );
  });

  it('returns empty receivables/payables when no customers/suppliers have a resolved account', async () => {
    const result = await service.query('company-a', {});

    expect(result.receivables).toEqual([]);
    expect(result.payables).toEqual([]);
    expect(result.totalReceivables).toBe('0.00');
    expect(result.totalPayables).toBe('0.00');
  });

  it('buckets a receivable line into "current" when entryDate is on asOfDate', async () => {
    customerRepository.find.mockResolvedValue([buildCustomer()]);
    queryBuilder.getRawMany.mockResolvedValue([
      {
        accountId: 'ar-account-1',
        debitAmount: '100.00',
        creditAmount: '0.00',
        entryDate: '2026-08-13',
      },
    ]);

    const result = await service.query('company-a', { asOfDate: '2026-08-13' });

    expect(result.receivables).toHaveLength(1);
    expect(result.receivables[0].current).toBe('100.00');
    expect(result.receivables[0].total).toBe('100.00');
    expect(result.totalReceivables).toBe('100.00');
  });

  it('buckets a receivable line into "over90" when entryDate is far in the past', async () => {
    customerRepository.find.mockResolvedValue([buildCustomer()]);
    queryBuilder.getRawMany.mockResolvedValue([
      {
        accountId: 'ar-account-1',
        debitAmount: '100.00',
        creditAmount: '0.00',
        entryDate: '2026-01-01',
      },
    ]);

    const result = await service.query('company-a', { asOfDate: '2026-08-13' });

    expect(result.receivables[0].over90).toBe('100.00');
    expect(result.receivables[0].current).toBe('0.00');
  });

  it('computes payable balance as credit - debit (natural credit balance)', async () => {
    supplierRepository.find.mockResolvedValue([buildSupplier()]);
    queryBuilder.getRawMany.mockResolvedValue([
      {
        accountId: 'ap-account-1',
        debitAmount: '0.00',
        creditAmount: '250.00',
        entryDate: '2026-08-13',
      },
    ]);

    const result = await service.query('company-a', { asOfDate: '2026-08-13' });

    expect(result.payables[0].total).toBe('250.00');
    expect(result.totalPayables).toBe('250.00');
  });

  it('excludes a customer with no receivableAccountId from the result', async () => {
    customerRepository.find.mockResolvedValue([
      buildCustomer({ id: 'cust-2', receivableAccountId: null }),
    ]);

    const result = await service.query('company-a', {});

    expect(result.receivables).toEqual([]);
  });

  it('defaults asOfDate to today when not supplied', async () => {
    const result = await service.query('company-a', {});

    expect(result.asOfDate).toBe(new Date().toISOString().slice(0, 10));
  });

  it('applies allowedBranchIds to both receivable and payable queries', async () => {
    customerRepository.find.mockResolvedValue([buildCustomer()]);
    supplierRepository.find.mockResolvedValue([buildSupplier()]);

    await service.query('company-a', {
      asOfDate: '2026-08-13',
      allowedBranchIds: ['branch-1'],
    });

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'journalEntry.branchId IN (:...allowedBranchIds)',
      { allowedBranchIds: ['branch-1'] },
    );
  });
});
