import { EntityManager, Repository } from 'typeorm';
import { PaymentsService } from './payments.service';
import { Payment } from '../entities/payment.entity';
import { PaymentDirection } from '../entities/payment-direction.enum';
import { PaymentReferenceType } from '../entities/payment-reference-type.enum';
import { PaymentMethodStatus } from '../entities/payment-method-status.enum';
import { TransactionService } from '../../../core/transaction/transaction.service';
import { CompaniesService } from '../../organization/services/companies.service';
import { CompanyStatus } from '../../organization/entities/company-status.enum';
import { BranchesService } from '../../organization/services/branches.service';
import { CustomersService } from '../../customer-supplier/services/customers.service';
import { CustomerStatus } from '../../customer-supplier/entities/customer-status.enum';
import { SuppliersService } from '../../customer-supplier/services/suppliers.service';
import { SupplierStatus } from '../../customer-supplier/entities/supplier-status.enum';
import { PaymentMethodsService } from './payment-methods.service';
import { SalesService } from '../../sales/services/sales.service';
import { PurchaseOrdersService } from '../../purchase/services/purchase-orders.service';
import { SaleReturnsService } from '../../sales-returns/services/sale-returns.service';
import { AccountingPostingService } from '../../accounting/services/accounting-posting.service';
import { ErrorCode } from '../../../core/errors/error-codes';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { OutboxService } from '../../outbox/services/outbox.service';
import { RequestContextService } from '../../../core/context/request-context.service';
import { PAYMENT_CONFIRMED_EVENT_TYPE } from '../events/payment-confirmed.event';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let paymentRepository: jest.Mocked<
    Pick<Repository<Payment>, 'findOne' | 'createQueryBuilder'>
  >;
  let transactionService: jest.Mocked<Pick<TransactionService, 'run'>>;
  let companiesService: jest.Mocked<
    Pick<CompaniesService, 'findActiveByIdOrNull'>
  >;
  let branchesService: jest.Mocked<
    Pick<BranchesService, 'findActiveByIdOrNull'>
  >;
  let customersService: jest.Mocked<
    Pick<CustomersService, 'findByIdInCompany'>
  >;
  let suppliersService: jest.Mocked<
    Pick<SuppliersService, 'findByIdInCompany'>
  >;
  let paymentMethodsService: jest.Mocked<
    Pick<PaymentMethodsService, 'findByIdInCompany'>
  >;
  let salesService: jest.Mocked<Pick<SalesService, 'applyPayment'>>;
  let purchaseOrdersService: jest.Mocked<
    Pick<PurchaseOrdersService, 'applyPayment'>
  >;
  let saleReturnsService: jest.Mocked<Pick<SaleReturnsService, 'applyRefund'>>;
  let accountingPostingService: jest.Mocked<
    Pick<AccountingPostingService, 'postPayment'>
  >;
  let outboxService: jest.Mocked<Pick<OutboxService, 'create'>>;
  let requestContextService: jest.Mocked<
    Pick<RequestContextService, 'getRequestId'>
  >;

  let manager: {
    query: jest.Mock;
    createQueryBuilder: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
  };
  let counterQueryBuilder: {
    where: jest.Mock;
    andWhere: jest.Mock;
    setLock: jest.Mock;
    getOneOrFail: jest.Mock;
  };

  const buildCompany = () =>
    ({ id: 'company-a', status: CompanyStatus.Active }) as never;
  const buildCustomer = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'cust-1',
      companyId: 'company-a',
      status: CustomerStatus.Active,
      ...overrides,
    }) as never;
  const buildSupplier = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'sup-1',
      companyId: 'company-a',
      status: SupplierStatus.Active,
      ...overrides,
    }) as never;
  const buildPaymentMethod = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'pm-1',
      companyId: 'company-a',
      status: PaymentMethodStatus.Active,
      ...overrides,
    }) as never;

  const baseDto = (
    overrides: Partial<CreatePaymentDto> = {},
  ): CreatePaymentDto => ({
    direction: PaymentDirection.Receipt,
    customerId: 'cust-1',
    paymentMethodId: 'pm-1',
    amount: '100.00',
    currency: 'USD',
    allocations: [
      {
        referenceType: PaymentReferenceType.Sale,
        referenceId: 'sale-1',
        allocatedAmount: '100.00',
      },
    ],
    ...overrides,
  });

  beforeEach(() => {
    paymentRepository = { findOne: jest.fn(), createQueryBuilder: jest.fn() };
    counterQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOneOrFail: jest
        .fn()
        .mockResolvedValue({ id: 'counter-1', lastSequence: 0 }),
    };
    manager = {
      query: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockReturnValue(counterQueryBuilder),
      create: jest.fn((_entity, data: Record<string, unknown>) => data),
      save: jest.fn((_entity, data: Record<string, unknown>) =>
        Promise.resolve({ id: 'new-id', ...data }),
      ),
      update: jest.fn().mockResolvedValue(undefined),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      findOneOrFail: jest.fn().mockResolvedValue(buildPaymentMethod()),
    };
    transactionService = {
      run: jest
        .fn()
        .mockImplementation((work: (m: EntityManager) => Promise<unknown>) =>
          work(manager as unknown as EntityManager),
        ),
    };
    companiesService = {
      findActiveByIdOrNull: jest.fn().mockResolvedValue(buildCompany()),
    };
    branchesService = { findActiveByIdOrNull: jest.fn() };
    customersService = {
      findByIdInCompany: jest.fn().mockResolvedValue(buildCustomer()),
    };
    suppliersService = {
      findByIdInCompany: jest.fn().mockResolvedValue(buildSupplier()),
    };
    paymentMethodsService = {
      findByIdInCompany: jest.fn().mockResolvedValue(buildPaymentMethod()),
    };
    salesService = { applyPayment: jest.fn().mockResolvedValue(undefined) };
    purchaseOrdersService = {
      applyPayment: jest.fn().mockResolvedValue(undefined),
    };
    saleReturnsService = {
      applyRefund: jest.fn().mockResolvedValue(undefined),
    };
    accountingPostingService = {
      postPayment: jest.fn().mockResolvedValue(undefined),
    };
    outboxService = {
      create: jest.fn().mockResolvedValue(undefined),
    };
    requestContextService = {
      getRequestId: jest.fn().mockReturnValue('req-1'),
    };

    service = new PaymentsService(
      paymentRepository as unknown as Repository<Payment>,
      transactionService as unknown as TransactionService,
      companiesService as unknown as CompaniesService,
      branchesService as unknown as BranchesService,
      customersService as unknown as CustomersService,
      suppliersService as unknown as SuppliersService,
      paymentMethodsService as unknown as PaymentMethodsService,
      salesService as unknown as SalesService,
      purchaseOrdersService as unknown as PurchaseOrdersService,
      saleReturnsService as unknown as SaleReturnsService,
      accountingPostingService as unknown as AccountingPostingService,
      outboxService,
      requestContextService as unknown as RequestContextService,
    );
  });

  describe('direction/party validation', () => {
    it('rejects a RECEIPT payment with no customerId', async () => {
      await expect(
        service.create(
          'company-a',
          'user-1',
          baseDto({ customerId: undefined }),
        ),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects a RECEIPT payment that also sets supplierId', async () => {
      await expect(
        service.create('company-a', 'user-1', baseDto({ supplierId: 'sup-1' })),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects a PAYMENT direction with no supplierId', async () => {
      await expect(
        service.create(
          'company-a',
          'user-1',
          baseDto({
            direction: PaymentDirection.Payment,
            customerId: undefined,
            allocations: [
              {
                referenceType: PaymentReferenceType.PurchaseOrder,
                referenceId: 'po-1',
                allocatedAmount: '100.00',
              },
            ],
          }),
        ),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects a blocked customer', async () => {
      customersService.findByIdInCompany.mockResolvedValue(
        buildCustomer({ status: CustomerStatus.Blocked }),
      );

      await expect(
        service.create('company-a', 'user-1', baseDto()),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });
  });

  describe('allocation/direction combination validation', () => {
    it('rejects RECEIPT + PURCHASE_ORDER allocation (400)', async () => {
      await expect(
        service.create(
          'company-a',
          'user-1',
          baseDto({
            allocations: [
              {
                referenceType: PaymentReferenceType.PurchaseOrder,
                referenceId: 'po-1',
                allocatedAmount: '100.00',
              },
            ],
          }),
        ),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects PAYMENT + SALE allocation (400)', async () => {
      await expect(
        service.create(
          'company-a',
          'user-1',
          baseDto({
            direction: PaymentDirection.Payment,
            customerId: undefined,
            supplierId: 'sup-1',
            allocations: [
              {
                referenceType: PaymentReferenceType.Sale,
                referenceId: 'sale-1',
                allocatedAmount: '100.00',
              },
            ],
          }),
        ),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects allocations summing to more than the payment amount', async () => {
      await expect(
        service.create(
          'company-a',
          'user-1',
          baseDto({
            amount: '50.00',
            allocations: [
              {
                referenceType: PaymentReferenceType.Sale,
                referenceId: 'sale-1',
                allocatedAmount: '30.00',
              },
              {
                referenceType: PaymentReferenceType.Sale,
                referenceId: 'sale-2',
                allocatedAmount: '30.00',
              },
            ],
          }),
        ),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects a zero/negative allocatedAmount', async () => {
      await expect(
        service.create(
          'company-a',
          'user-1',
          baseDto({
            allocations: [
              {
                referenceType: PaymentReferenceType.Sale,
                referenceId: 'sale-1',
                allocatedAmount: '0.00',
              },
            ],
          }),
        ),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });
  });

  describe('payment method validation', () => {
    it('rejects an inactive payment method', async () => {
      paymentMethodsService.findByIdInCompany.mockResolvedValue(
        buildPaymentMethod({ status: PaymentMethodStatus.Inactive }),
      );

      await expect(
        service.create('company-a', 'user-1', baseDto()),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });
  });

  describe('successful creation', () => {
    it('creates a RECEIPT payment, applies payment to the Sale, and returns it with allocations', async () => {
      const result = await service.create('company-a', 'user-1', baseDto());

      expect(result.wasExisting).toBe(false);
      expect(salesService.applyPayment).toHaveBeenCalledWith(
        'sale-1',
        'company-a',
        100,
        'user-1',
        manager,
      );
      expect(purchaseOrdersService.applyPayment).not.toHaveBeenCalled();
      expect(result.payment.paymentNumber).toMatch(/^PMT-\d{4}-\d{6}$/);
    });

    it('writes a payment.confirmed OutboxEvent via the transactional manager, after postPayment()', async () => {
      const callOrder: string[] = [];
      accountingPostingService.postPayment.mockImplementation(() => {
        callOrder.push('postPayment');
        return Promise.resolve(undefined as never);
      });
      outboxService.create.mockImplementation(() => {
        callOrder.push('outboxService.create');
        return Promise.resolve(undefined as never);
      });

      const result = await service.create('company-a', 'user-1', baseDto());
      const paymentId: string = result.payment.id;

      expect(callOrder).toEqual(['postPayment', 'outboxService.create']);
      expect(outboxService.create).toHaveBeenCalledTimes(1);
      const [calledManager, calledEvent] = outboxService.create.mock.calls[0];
      expect(calledManager).toBe(manager);
      expect(calledEvent.eventType).toBe(PAYMENT_CONFIRMED_EVENT_TYPE);
      expect(calledEvent.eventVersion).toBe(1);
      expect(calledEvent.aggregateType).toBe('Payment');
      expect(calledEvent.aggregateId).toBe(paymentId);
      expect(calledEvent.companyId).toBe('company-a');
      expect(calledEvent.correlationId).toBe('req-1');
      expect(calledEvent.causationId).toBeNull();
      expect(calledEvent.payload).toMatchObject({
        paymentId,
        direction: PaymentDirection.Receipt,
        amount: '100.00',
        currency: 'USD',
        customerId: 'cust-1',
        supplierId: null,
      });
    });

    it('creates a PAYMENT and applies it to the PurchaseOrder, never the SalesService', async () => {
      const result = await service.create(
        'company-a',
        'user-1',
        baseDto({
          direction: PaymentDirection.Payment,
          customerId: undefined,
          supplierId: 'sup-1',
          allocations: [
            {
              referenceType: PaymentReferenceType.PurchaseOrder,
              referenceId: 'po-1',
              allocatedAmount: '100.00',
            },
          ],
        }),
      );

      expect(result.wasExisting).toBe(false);
      expect(purchaseOrdersService.applyPayment).toHaveBeenCalledWith(
        'po-1',
        'company-a',
        100,
        'user-1',
        manager,
      );
      expect(salesService.applyPayment).not.toHaveBeenCalled();
    });

    it('sums multiple allocations against the same target into a single applyPayment call', async () => {
      await service.create(
        'company-a',
        'user-1',
        baseDto({
          amount: '100.00',
          allocations: [
            {
              referenceType: PaymentReferenceType.Sale,
              referenceId: 'sale-1',
              allocatedAmount: '40.00',
            },
            {
              referenceType: PaymentReferenceType.Sale,
              referenceId: 'sale-1',
              allocatedAmount: '60.00',
            },
          ],
        }),
      );

      expect(salesService.applyPayment).toHaveBeenCalledTimes(1);
      expect(salesService.applyPayment).toHaveBeenCalledWith(
        'sale-1',
        'company-a',
        100,
        'user-1',
        manager,
      );
    });

    it('locks multiple distinct targets in deterministic (referenceType, referenceId) order', async () => {
      const callOrder: string[] = [];
      salesService.applyPayment.mockImplementation((id: string) => {
        callOrder.push(`SALE:${id}`);
        return Promise.resolve();
      });

      await service.create(
        'company-a',
        'user-1',
        baseDto({
          amount: '100.00',
          allocations: [
            {
              referenceType: PaymentReferenceType.Sale,
              referenceId: 'sale-zeta',
              allocatedAmount: '40.00',
            },
            {
              referenceType: PaymentReferenceType.Sale,
              referenceId: 'sale-alpha',
              allocatedAmount: '60.00',
            },
          ],
        }),
      );

      // Deterministic order = sorted by referenceId (both are SALE), i.e.
      // "sale-alpha" before "sale-zeta" — regardless of input array order.
      expect(callOrder).toEqual(['SALE:sale-alpha', 'SALE:sale-zeta']);
    });
  });

  describe('idempotency', () => {
    it('returns the existing payment without creating a new one when the key matches', async () => {
      const existing = { id: 'existing-payment' } as Payment;
      paymentRepository.findOne.mockResolvedValue(existing);

      const result = await service.create(
        'company-a',
        'user-1',
        baseDto(),
        'my-idempotency-key',
      );

      expect(result).toEqual({ payment: existing, wasExisting: true });
      expect(transactionService.run).not.toHaveBeenCalled();
    });

    it('creates a new payment and stores the idempotency key when none exists yet', async () => {
      paymentRepository.findOne.mockResolvedValue(null);

      const result = await service.create(
        'company-a',
        'user-1',
        baseDto(),
        'brand-new-key',
      );

      expect(result.wasExisting).toBe(false);
      expect(transactionService.run).toHaveBeenCalled();
    });

    it('recovers from a duplicate-key race by re-fetching the winning row', async () => {
      paymentRepository.findOne
        .mockResolvedValueOnce(null) // pre-transaction lookup: not found
        .mockResolvedValueOnce({ id: 'winner' } as Payment); // post-race re-fetch

      const duplicateError = Object.assign(
        new Error('Duplicate entry for key IDX_pay_company_idempotency_key'),
        {
          code: 'ER_DUP_ENTRY',
          errno: 1062,
        },
      );
      transactionService.run.mockRejectedValueOnce(duplicateError);

      const result = await service.create(
        'company-a',
        'user-1',
        baseDto(),
        'racing-key',
      );

      expect(result).toEqual({ payment: { id: 'winner' }, wasExisting: true });
    });
  });

  describe('company/branch validation', () => {
    it('rejects an inactive company', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(null);

      await expect(
        service.create('company-a', 'user-1', baseDto()),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects a branchId belonging to a different company', async () => {
      branchesService.findActiveByIdOrNull.mockResolvedValue({
        id: 'branch-1',
        companyId: 'other-company',
      } as never);

      await expect(
        service.create(
          'company-a',
          'user-1',
          baseDto({ branchId: 'branch-1' }),
        ),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });
  });
});
