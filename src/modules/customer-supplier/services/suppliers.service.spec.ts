import { Repository, SelectQueryBuilder } from 'typeorm';
import { SuppliersService } from './suppliers.service';
import { Supplier } from '../entities/supplier.entity';
import { SupplierStatus } from '../entities/supplier-status.enum';
import { SupplierGroupStatus } from '../entities/supplier-group-status.enum';
import { PaymentTermStatus } from '../entities/payment-term-status.enum';
import { CompaniesService } from '../../organization/services/companies.service';
import { BranchesService } from '../../organization/services/branches.service';
import { SupplierGroupsService } from './supplier-groups.service';
import { PaymentTermsService } from './payment-terms.service';
import { Company } from '../../organization/entities/company.entity';
import { CompanyStatus } from '../../organization/entities/company-status.enum';
import { Branch } from '../../organization/entities/branch.entity';
import { ErrorCode } from '../../../core/errors/error-codes';
import { PurchaseOrder } from '../../purchase/entities/purchase-order.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { GoodsReceipt } from '../../inventory/entities/goods-receipt.entity';

describe('SuppliersService', () => {
  let service: SuppliersService;
  let supplierRepository: jest.Mocked<
    Pick<
      Repository<Supplier>,
      'findOne' | 'create' | 'save' | 'softRemove' | 'createQueryBuilder'
    >
  >;
  let companiesService: jest.Mocked<
    Pick<CompaniesService, 'findActiveByIdOrNull'>
  >;
  let branchesService: jest.Mocked<
    Pick<BranchesService, 'findActiveByIdOrNull'>
  >;
  let supplierGroupsService: jest.Mocked<
    Pick<SupplierGroupsService, 'findByIdInCompany'>
  >;
  let paymentTermsService: jest.Mocked<
    Pick<PaymentTermsService, 'findByIdInCompany'>
  >;
  let purchaseOrderRepository: jest.Mocked<Pick<Repository<PurchaseOrder>, 'count'>>;
  let paymentRepository: jest.Mocked<Pick<Repository<Payment>, 'count'>>;
  let goodsReceiptRepository: jest.Mocked<Pick<Repository<GoodsReceipt>, 'count'>>;
  let queryBuilder: jest.Mocked<
    Pick<
      SelectQueryBuilder<Supplier>,
      'where' | 'andWhere' | 'orderBy' | 'skip' | 'take' | 'getManyAndCount'
    >
  >;

  const buildCompany = (overrides: Partial<Company> = {}): Company =>
    ({
      id: 'company-a',
      status: CompanyStatus.Active,
      ...overrides,
    }) as Company;

  const buildBranch = (overrides: Partial<Branch> = {}): Branch =>
    ({ id: 'branch-1', companyId: 'company-a', ...overrides }) as Branch;

  const buildSupplier = (overrides: Partial<Supplier> = {}): Supplier =>
    ({
      id: 'supp-1',
      companyId: 'company-a',
      branchId: null,
      supplierCode: 'SUPP001',
      name: 'Fabric Co',
      displayName: null,
      phone: null,
      email: null,
      country: null,
      supplierGroupId: null,
      paymentTermId: null,
      creditDays: 0,
      openingBalanceAmount: '0.00',
      payableAccountId: null,
      status: SupplierStatus.Active,
      notes: null,
      ...overrides,
    }) as Supplier;

  beforeEach(() => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };
    supplierRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softRemove: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    companiesService = { findActiveByIdOrNull: jest.fn() };
    branchesService = { findActiveByIdOrNull: jest.fn() };
    supplierGroupsService = { findByIdInCompany: jest.fn() };
    paymentTermsService = { findByIdInCompany: jest.fn() };
    purchaseOrderRepository = { count: jest.fn().mockResolvedValue(0) };
    paymentRepository = { count: jest.fn().mockResolvedValue(0) };
    goodsReceiptRepository = { count: jest.fn().mockResolvedValue(0) };

    service = new SuppliersService(
      supplierRepository as unknown as Repository<Supplier>,
      purchaseOrderRepository as unknown as Repository<PurchaseOrder>,
      paymentRepository as unknown as Repository<Payment>,
      goodsReceiptRepository as unknown as Repository<GoodsReceipt>,
      companiesService as unknown as CompaniesService,
      branchesService as unknown as BranchesService,
      supplierGroupsService as unknown as SupplierGroupsService,
      paymentTermsService as unknown as PaymentTermsService,
    );
  });

  describe('create', () => {
    it('creates a supplier with default credit/opening-balance values when omitted', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      supplierRepository.findOne.mockResolvedValue(null);
      const created = buildSupplier();
      supplierRepository.create.mockReturnValue(created);
      supplierRepository.save.mockResolvedValue(created);

      const result = await service.create('company-a', {
        supplierCode: 'SUPP001',
        name: 'Fabric Co',
      });

      expect(result).toBe(created);
      expect(supplierRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          creditDays: 0,
          country: null,
          openingBalanceAmount: '0.00',
          status: SupplierStatus.Active,
        }),
      );
    });

    it('rejects a duplicate supplierCode within the same company (409)', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      supplierRepository.findOne.mockResolvedValue(buildSupplier());

      await expect(
        service.create('company-a', { supplierCode: 'SUPP001', name: 'Dup' }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });
    });

    it('rejects a branchId belonging to a different company (cross-company integrity)', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      branchesService.findActiveByIdOrNull.mockResolvedValue(
        buildBranch({ companyId: 'company-b' }),
      );

      await expect(
        service.create('company-a', {
          supplierCode: 'SUPP001',
          name: 'Fabric Co',
          branchId: 'branch-1',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects an inactive supplierGroupId', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      supplierGroupsService.findByIdInCompany.mockResolvedValue({
        status: SupplierGroupStatus.Inactive,
      } as never);

      await expect(
        service.create('company-a', {
          supplierCode: 'SUPP001',
          name: 'Fabric Co',
          supplierGroupId: 'group-1',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });

    it('rejects an inactive paymentTermId', async () => {
      companiesService.findActiveByIdOrNull.mockResolvedValue(buildCompany());
      paymentTermsService.findByIdInCompany.mockResolvedValue({
        status: PaymentTermStatus.Inactive,
      } as never);

      await expect(
        service.create('company-a', {
          supplierCode: 'SUPP001',
          name: 'Fabric Co',
          paymentTermId: 'term-1',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCode.ValidationError });
    });
  });

  describe('block', () => {
    it('sets status to BLOCKED', async () => {
      supplierRepository.findOne.mockResolvedValue(buildSupplier());
      supplierRepository.save.mockImplementation((input) =>
        Promise.resolve(input as Supplier),
      );

      const result = await service.block('supp-1', 'company-a');

      expect(result.status).toBe(SupplierStatus.Blocked);
    });
  });

  describe('findByIdInCompany — cross-company isolation', () => {
    it('throws NotFound for a supplier belonging to a different company', async () => {
      supplierRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findByIdInCompany('supp-1', 'company-b'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.NotFound });
    });
  });

  describe('remove', () => {
    it('soft-deletes the supplier (historical integrity)', async () => {
      const supplier = buildSupplier();
      supplierRepository.findOne.mockResolvedValue(supplier);

      await service.remove('supp-1', 'company-a');

      expect(supplierRepository.softRemove).toHaveBeenCalledWith(supplier);
    });

    it('rejects delete when purchase history already references the supplier', async () => {
      supplierRepository.findOne.mockResolvedValue(buildSupplier());
      purchaseOrderRepository.count.mockResolvedValue(1);

      await expect(
        service.remove('supp-1', 'company-a'),
      ).rejects.toMatchObject({ errorCode: ErrorCode.Conflict });

      expect(supplierRepository.softRemove).not.toHaveBeenCalled();
    });
  });
});
