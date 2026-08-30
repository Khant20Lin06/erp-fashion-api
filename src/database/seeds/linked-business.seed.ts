import 'dotenv/config';
import {
  createScriptLogger,
  logScriptFailure,
} from '../../common/logging/script-logger';
import { v4 as uuidv4 } from 'uuid';
import { AppDataSource } from '../data-source';
import { Company } from '../../modules/organization/entities/company.entity';
import { Branch } from '../../modules/organization/entities/branch.entity';
import { Warehouse } from '../../modules/organization/entities/warehouse.entity';
import { UserCompany } from '../../modules/organization/entities/user-company.entity';
import { UserBranch } from '../../modules/organization/entities/user-branch.entity';
import { UserWarehouse } from '../../modules/organization/entities/user-warehouse.entity';
import { MembershipStatus } from '../../modules/organization/entities/membership-status.enum';
import { User } from '../../modules/users/entities/user.entity';
import { Employee } from '../../modules/employees/entities/employee.entity';
import { EmployeeStatus } from '../../modules/employees/entities/employee-status.enum';
import { Department } from '../../modules/hr/entities/department.entity';
import { DepartmentStatus } from '../../modules/hr/entities/department-status.enum';
import { Designation } from '../../modules/hr/entities/designation.entity';
import { DesignationStatus } from '../../modules/hr/entities/designation-status.enum';
import { EmployeeAssignment } from '../../modules/hr/entities/employee-assignment.entity';
import { EmployeeAssignmentStatus } from '../../modules/hr/entities/employee-assignment-status.enum';
import { LeaveType } from '../../modules/hr/entities/leave-type.entity';

const logger = createScriptLogger('LinkedBusinessSeed');
import { LeaveTypeStatus } from '../../modules/hr/entities/leave-type-status.enum';
import { LeaveRequest } from '../../modules/hr/entities/leave-request.entity';
import { LeaveRequestStatus } from '../../modules/hr/entities/leave-request-status.enum';
import { AttendanceRecord } from '../../modules/hr/entities/attendance-record.entity';
import { AttendanceStatus } from '../../modules/hr/entities/attendance-status.enum';
import { CustomerGroup } from '../../modules/customer-supplier/entities/customer-group.entity';
import { CustomerGroupStatus } from '../../modules/customer-supplier/entities/customer-group-status.enum';
import { SupplierGroup } from '../../modules/customer-supplier/entities/supplier-group.entity';
import { SupplierGroupStatus } from '../../modules/customer-supplier/entities/supplier-group-status.enum';
import { PaymentTerm } from '../../modules/customer-supplier/entities/payment-term.entity';
import { PaymentTermStatus } from '../../modules/customer-supplier/entities/payment-term-status.enum';
import { Customer } from '../../modules/customer-supplier/entities/customer.entity';
import { CustomerStatus } from '../../modules/customer-supplier/entities/customer-status.enum';
import { Supplier } from '../../modules/customer-supplier/entities/supplier.entity';
import { SupplierStatus } from '../../modules/customer-supplier/entities/supplier-status.enum';
import { ProductVariant } from '../../modules/products/entities/product-variant.entity';
import { ProductVariantUom } from '../../modules/products/entities/product-variant-uom.entity';
import { ProductVariantUomUsageType } from '../../modules/products/entities/product-variant-uom-usage-type.enum';
import { PriceList } from '../../modules/products/entities/price-list.entity';
import { PriceListStatus } from '../../modules/products/entities/price-list-status.enum';
import { PriceListItem } from '../../modules/products/entities/price-list-item.entity';
import { PriceListItemStatus } from '../../modules/products/entities/price-list-item-status.enum';
import { Sale } from '../../modules/sales/entities/sale.entity';
import { SaleItem } from '../../modules/sales/entities/sale-item.entity';
import { SaleStatus } from '../../modules/sales/entities/sale-status.enum';
import { SaleType } from '../../modules/sales/entities/sale-type.enum';
import { SalesAccount } from '../../modules/sales-accounts/entities/sales-account.entity';
import { SalesAccountStatus } from '../../modules/sales-accounts/entities/sales-account-status.enum';
import { SalesAccountAssignment } from '../../modules/sales-accounts/entities/sales-account-assignment.entity';
import { SalesAccountAssignmentStatus } from '../../modules/sales-accounts/entities/sales-account-assignment-status.enum';
import { PurchaseOrder } from '../../modules/purchase/entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../modules/purchase/entities/purchase-order-item.entity';
import { PurchaseOrderStatus } from '../../modules/purchase/entities/purchase-order-status.enum';
import { PurchaseType } from '../../modules/purchase/entities/purchase-type.enum';
import { PaymentMethod } from '../../modules/payments/entities/payment-method.entity';
import { PaymentMethodStatus } from '../../modules/payments/entities/payment-method-status.enum';
import { Payment } from '../../modules/payments/entities/payment.entity';
import { PaymentDirection } from '../../modules/payments/entities/payment-direction.enum';
import { PaymentStatus } from '../../modules/payments/entities/payment-status.enum';
import { PaymentAllocation } from '../../modules/payments/entities/payment-allocation.entity';
import { PaymentReferenceType } from '../../modules/payments/entities/payment-reference-type.enum';
import { Account } from '../../modules/accounting/entities/account.entity';
import { AccountType } from '../../modules/accounting/entities/account-type.enum';
import { EmployeeCompensation } from '../../modules/payroll/entities/employee-compensation.entity';
import { EmployeePayrollComponent } from '../../modules/payroll/entities/employee-payroll-component.entity';
import { PayrollComponent } from '../../modules/payroll/entities/payroll-component.entity';
import { PayrollConfiguration } from '../../modules/payroll/entities/payroll-configuration.entity';
import { PayrollPeriod } from '../../modules/payroll/entities/payroll-period.entity';
import { CompanyPayrollPeriodCounter } from '../../modules/payroll/entities/company-payroll-period-counter.entity';
import { PayrollRun } from '../../modules/payroll/entities/payroll-run.entity';
import { CompanyPayrollRunCounter } from '../../modules/payroll/entities/company-payroll-run-counter.entity';
import { PayrollRunEmployee } from '../../modules/payroll/entities/payroll-run-employee.entity';
import { PayrollRunEmployeeItem } from '../../modules/payroll/entities/payroll-run-employee-item.entity';
import { PayFrequency } from '../../modules/payroll/entities/pay-frequency.enum';
import { PayrollComponentType } from '../../modules/payroll/entities/payroll-component-type.enum';
import { PayrollCalculationType } from '../../modules/payroll/entities/payroll-calculation-type.enum';
import { UnpaidLeaveCalculation } from '../../modules/payroll/entities/unpaid-leave-calculation.enum';
import { PayrollPeriodStatus } from '../../modules/payroll/entities/payroll-period-status.enum';
import { PayrollRunStatus } from '../../modules/payroll/entities/payroll-run-status.enum';
import { PayrollRunEmployeeStatus } from '../../modules/payroll/entities/payroll-run-employee-status.enum';
import { Uom } from '../../modules/uom/entities/uom.entity';
import { UomCategory } from '../../modules/uom/entities/uom-category.enum';
import { FindOptionsWhere, IsNull, Repository } from 'typeorm';

type NamedSeed = {
  code: string;
  name: string;
  description?: string;
};

type UomSeed = {
  code: string;
  name: string;
  symbol: string;
  category: UomCategory;
  decimalPlaces: number;
};

type PriceListSeed = {
  code: string;
  name: string;
  description: string;
  currency: string;
  status: PriceListStatus;
};

const COMPANY_CODE = 'FASHION-ENT-MAIN';
const PRICE_CURRENCY = 'USD';
const CORE_PRICE_VALID_FROM = '2026-01-01T00:00:00.000Z';
const PROMO_PRICE_VALID_FROM = '2026-08-20T00:00:00.000Z';
const PROMO_PRICE_VALID_TO = '2026-09-15T23:59:59.000Z';

const UOM_BLUEPRINTS: UomSeed[] = [
  {
    code: 'PCS',
    name: 'Piece',
    symbol: 'pc',
    category: UomCategory.Count,
    decimalPlaces: 0,
  },
  {
    code: 'PACK3',
    name: 'Pack of 3',
    symbol: 'pk3',
    category: UomCategory.Count,
    decimalPlaces: 0,
  },
  {
    code: 'PACK6',
    name: 'Pack of 6',
    symbol: 'pk6',
    category: UomCategory.Count,
    decimalPlaces: 0,
  },
  {
    code: 'CARTON12',
    name: 'Carton of 12',
    symbol: 'ctn12',
    category: UomCategory.Count,
    decimalPlaces: 0,
  },
];

const PRICE_LIST_BLUEPRINTS: PriceListSeed[] = [
  {
    code: 'PL-RETAIL-USD',
    name: 'Standard Retail Price List',
    description:
      'Default in-store selling prices per piece and retail sales packs.',
    currency: PRICE_CURRENCY,
    status: PriceListStatus.Active,
  },
  {
    code: 'PL-WHOLESALE-USD',
    name: 'Wholesale Pack Price List',
    description:
      'Bulk and reseller pricing for larger pack and carton transactions.',
    currency: PRICE_CURRENCY,
    status: PriceListStatus.Active,
  },
  {
    code: 'PL-PROMO-USD',
    name: 'Seasonal Campaign Price List',
    description:
      'Time-boxed markdown pricing for selected seasonal campaign variants.',
    currency: PRICE_CURRENCY,
    status: PriceListStatus.Active,
  },
];

const DEPARTMENTS: NamedSeed[] = [
  {
    code: 'DEPT-SALES',
    name: 'Sales',
    description: 'Retail and customer-facing sales team',
  },
  {
    code: 'DEPT-WH',
    name: 'Warehouse',
    description: 'Inventory and fulfilment operations',
  },
  {
    code: 'DEPT-BUY',
    name: 'Buying',
    description: 'Purchasing and supplier management',
  },
  {
    code: 'DEPT-HR',
    name: 'Human Resources',
    description: 'People operations and attendance',
  },
];

const DESIGNATIONS: NamedSeed[] = [
  { code: 'DES-STORE-MGR', name: 'Store Manager' },
  { code: 'DES-SALES-EXEC', name: 'Sales Executive' },
  { code: 'DES-WH-LEAD', name: 'Warehouse Lead' },
  { code: 'DES-BUYER', name: 'Buyer' },
];

const CUSTOMER_GROUPS: NamedSeed[] = [
  {
    code: 'CG-RETAIL',
    name: 'Retail',
    description: 'Walk-in and POS customers',
  },
  { code: 'CG-VIP', name: 'VIP', description: 'Premium repeat customers' },
  {
    code: 'CG-WHOLESALE',
    name: 'Wholesale',
    description: 'Bulk and B2B customers',
  },
];

const SUPPLIER_GROUPS: NamedSeed[] = [
  {
    code: 'SG-FABRIC',
    name: 'Fabric Mills',
    description: 'Textile and fabric suppliers',
  },
  {
    code: 'SG-GARMENT',
    name: 'Garment Factories',
    description: 'Finished-goods manufacturing partners',
  },
  {
    code: 'SG-ACCESSORY',
    name: 'Accessories',
    description: 'Packaging and accessory vendors',
  },
];

const PAYMENT_TERMS = [
  {
    code: 'PT-CASH',
    name: 'Cash',
    dueDays: 0,
    description: 'Immediate settlement',
  },
  {
    code: 'PT-NET15',
    name: 'Net 15',
    dueDays: 15,
    description: 'Payment due within 15 days',
  },
  {
    code: 'PT-NET30',
    name: 'Net 30',
    dueDays: 30,
    description: 'Payment due within 30 days',
  },
];

const PAYMENT_METHODS = [
  { code: 'PM-CASH', name: 'Cash' },
  { code: 'PM-CARD', name: 'Card' },
  { code: 'PM-BANK', name: 'Bank Transfer' },
];

const ACCOUNT_BLUEPRINTS = [
  { code: '1100-CASH', name: 'Cash on Hand', accountType: AccountType.Asset },
  { code: '1110-BANK', name: 'Bank Clearing', accountType: AccountType.Asset },
  {
    code: '1200-AR',
    name: 'Accounts Receivable',
    accountType: AccountType.Asset,
  },
  {
    code: '2000-AP',
    name: 'Accounts Payable',
    accountType: AccountType.Liability,
  },
];

const EMPLOYEE_BLUEPRINTS = [
  {
    code: 'EMP-1001',
    firstName: 'Aung',
    lastName: 'Kyaw',
    branchCode: 'BR-YGN-MAIN',
    departmentCode: 'DEPT-SALES',
    designationCode: 'DES-STORE-MGR',
    warehouseCode: 'WH-YGN-CENTRAL',
    userEmail: 'admin@fashionerp.com',
  },
  {
    code: 'EMP-1002',
    firstName: 'May',
    lastName: 'Thu',
    branchCode: 'BR-MDY-CENTRAL',
    departmentCode: 'DEPT-SALES',
    designationCode: 'DES-SALES-EXEC',
    warehouseCode: 'WH-MDY-STORE',
    userEmail: null,
  },
  {
    code: 'EMP-1003',
    firstName: 'Ko',
    lastName: 'Min',
    branchCode: 'BR-YGN-MAIN',
    departmentCode: 'DEPT-WH',
    designationCode: 'DES-WH-LEAD',
    warehouseCode: 'WH-YGN-CENTRAL',
    userEmail: null,
  },
  {
    code: 'EMP-1004',
    firstName: 'Hnin',
    lastName: 'Pwint',
    branchCode: 'BR-NPT-MALL',
    departmentCode: 'DEPT-BUY',
    designationCode: 'DES-BUYER',
    warehouseCode: 'WH-NPT-STORE',
    userEmail: null,
  },
];

const PAYROLL_COMPONENT_BLUEPRINTS = [
  {
    code: 'HOUSING',
    name: 'Housing Allowance',
    type: PayrollComponentType.Earning,
    calculationType: PayrollCalculationType.FixedAmount,
    fixedAmount: '180.00',
    percentage: null,
    isTaxable: true,
  },
  {
    code: 'TRANSPORT',
    name: 'Transport Allowance',
    type: PayrollComponentType.Earning,
    calculationType: PayrollCalculationType.FixedAmount,
    fixedAmount: '75.00',
    percentage: null,
    isTaxable: false,
  },
  {
    code: 'INCOME_TAX',
    name: 'Income Tax',
    type: PayrollComponentType.Deduction,
    calculationType: PayrollCalculationType.PercentageOfBase,
    fixedAmount: null,
    percentage: '8.0000',
    isTaxable: false,
  },
  {
    code: 'SSB_EMPLOYEE',
    name: 'Employee Social Security',
    type: PayrollComponentType.Deduction,
    calculationType: PayrollCalculationType.PercentageOfBase,
    fixedAmount: null,
    percentage: '2.0000',
    isTaxable: false,
  },
  {
    code: 'SSB_EMPLOYER',
    name: 'Employer Social Security',
    type: PayrollComponentType.EmployerContribution,
    calculationType: PayrollCalculationType.PercentageOfBase,
    fixedAmount: null,
    percentage: '3.0000',
    isTaxable: false,
  },
] as const;

const PAYROLL_COMPENSATION_BLUEPRINTS = [
  { employeeCode: 'EMP-1001', baseSalary: '2200.00' },
  { employeeCode: 'EMP-1002', baseSalary: '900.00' },
  { employeeCode: 'EMP-1003', baseSalary: '1100.00' },
  { employeeCode: 'EMP-1004', baseSalary: '1400.00' },
] as const;

const EMPLOYEE_PAYROLL_COMPONENT_BLUEPRINTS = [
  { employeeCode: 'EMP-1001', componentCode: 'HOUSING', amount: '250.00' },
  { employeeCode: 'EMP-1001', componentCode: 'TRANSPORT', amount: '90.00' },
  { employeeCode: 'EMP-1001', componentCode: 'INCOME_TAX' },
  { employeeCode: 'EMP-1001', componentCode: 'SSB_EMPLOYEE' },
  { employeeCode: 'EMP-1001', componentCode: 'SSB_EMPLOYER' },
  { employeeCode: 'EMP-1002', componentCode: 'TRANSPORT', amount: '60.00' },
  { employeeCode: 'EMP-1002', componentCode: 'INCOME_TAX' },
  { employeeCode: 'EMP-1002', componentCode: 'SSB_EMPLOYEE' },
  { employeeCode: 'EMP-1002', componentCode: 'SSB_EMPLOYER' },
  { employeeCode: 'EMP-1003', componentCode: 'TRANSPORT', amount: '75.00' },
  { employeeCode: 'EMP-1003', componentCode: 'INCOME_TAX' },
  { employeeCode: 'EMP-1003', componentCode: 'SSB_EMPLOYEE' },
  { employeeCode: 'EMP-1003', componentCode: 'SSB_EMPLOYER' },
  { employeeCode: 'EMP-1004', componentCode: 'HOUSING', amount: '180.00' },
  { employeeCode: 'EMP-1004', componentCode: 'TRANSPORT', amount: '75.00' },
  { employeeCode: 'EMP-1004', componentCode: 'INCOME_TAX' },
  { employeeCode: 'EMP-1004', componentCode: 'SSB_EMPLOYEE' },
  { employeeCode: 'EMP-1004', componentCode: 'SSB_EMPLOYER' },
] as const;

const PAYROLL_PERIOD_BLUEPRINTS = [
  {
    periodNumber: 'PP-2026-000001',
    name: 'July 2026',
    startDate: '2026-07-01',
    endDate: '2026-07-31',
    payDate: '2026-08-05',
    status: PayrollPeriodStatus.Finalized,
  },
  {
    periodNumber: 'PP-2026-000002',
    name: 'August 2026',
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    payDate: '2026-09-05',
    status: PayrollPeriodStatus.Open,
  },
] as const;

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

function money(value: number): string {
  return value.toFixed(2);
}

function isoDateDaysAgo(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

async function findSeedRow<T extends object>(
  repo: Repository<T>,
  where: FindOptionsWhere<T> | FindOptionsWhere<T>[],
): Promise<T | null> {
  const entity = await repo.findOne({ where, withDeleted: true });
  const restorable = entity as (T & { deletedAt?: Date | null }) | null;
  if (restorable?.deletedAt) {
    restorable.deletedAt = null;
    return repo.save(restorable as T);
  }
  return entity;
}

async function seedLinkedBusinessData(): Promise<void> {
  await AppDataSource.initialize();
  logger.log('Seeding linked business data...');

  const companyRepo = AppDataSource.getRepository(Company);
  const branchRepo = AppDataSource.getRepository(Branch);
  const warehouseRepo = AppDataSource.getRepository(Warehouse);
  const userRepo = AppDataSource.getRepository(User);
  const userCompanyRepo = AppDataSource.getRepository(UserCompany);
  const userBranchRepo = AppDataSource.getRepository(UserBranch);
  const userWarehouseRepo = AppDataSource.getRepository(UserWarehouse);
  const employeeRepo = AppDataSource.getRepository(Employee);
  const departmentRepo = AppDataSource.getRepository(Department);
  const designationRepo = AppDataSource.getRepository(Designation);
  const assignmentRepo = AppDataSource.getRepository(EmployeeAssignment);
  const leaveTypeRepo = AppDataSource.getRepository(LeaveType);
  const leaveRequestRepo = AppDataSource.getRepository(LeaveRequest);
  const attendanceRepo = AppDataSource.getRepository(AttendanceRecord);
  const customerGroupRepo = AppDataSource.getRepository(CustomerGroup);
  const supplierGroupRepo = AppDataSource.getRepository(SupplierGroup);
  const paymentTermRepo = AppDataSource.getRepository(PaymentTerm);
  const customerRepo = AppDataSource.getRepository(Customer);
  const supplierRepo = AppDataSource.getRepository(Supplier);
  const variantRepo = AppDataSource.getRepository(ProductVariant);
  const uomRepo = AppDataSource.getRepository(Uom);
  const variantUomRepo = AppDataSource.getRepository(ProductVariantUom);
  const priceListRepo = AppDataSource.getRepository(PriceList);
  const priceListItemRepo = AppDataSource.getRepository(PriceListItem);
  const saleRepo = AppDataSource.getRepository(Sale);
  const saleItemRepo = AppDataSource.getRepository(SaleItem);
  const salesAccountRepo = AppDataSource.getRepository(SalesAccount);
  const salesAccountAssignmentRepo = AppDataSource.getRepository(
    SalesAccountAssignment,
  );
  const purchaseOrderRepo = AppDataSource.getRepository(PurchaseOrder);
  const purchaseOrderItemRepo = AppDataSource.getRepository(PurchaseOrderItem);
  const paymentMethodRepo = AppDataSource.getRepository(PaymentMethod);
  const paymentRepo = AppDataSource.getRepository(Payment);
  const paymentAllocationRepo = AppDataSource.getRepository(PaymentAllocation);
  const accountRepo = AppDataSource.getRepository(Account);
  const compensationRepo = AppDataSource.getRepository(EmployeeCompensation);
  const employeePayrollComponentRepo = AppDataSource.getRepository(
    EmployeePayrollComponent,
  );
  const payrollComponentRepo = AppDataSource.getRepository(PayrollComponent);
  const payrollConfigurationRepo = AppDataSource.getRepository(
    PayrollConfiguration,
  );
  const payrollPeriodRepo = AppDataSource.getRepository(PayrollPeriod);
  const payrollPeriodCounterRepo = AppDataSource.getRepository(
    CompanyPayrollPeriodCounter,
  );
  const payrollRunRepo = AppDataSource.getRepository(PayrollRun);
  const payrollRunCounterRepo = AppDataSource.getRepository(
    CompanyPayrollRunCounter,
  );
  const payrollRunEmployeeRepo = AppDataSource.getRepository(PayrollRunEmployee);
  const payrollRunEmployeeItemRepo = AppDataSource.getRepository(
    PayrollRunEmployeeItem,
  );

  const company = await findSeedRow(companyRepo, { code: COMPANY_CODE });
  if (!company) {
    throw new Error(
      `Company ${COMPANY_CODE} not found. Run enterprise and bulk seeds first.`,
    );
  }

  const branches = await branchRepo.find({ where: { companyId: company.id } });
  const warehouses = await warehouseRepo.find({
    where: { companyId: company.id },
  });
  const adminUser = await userRepo.findOne({
    where: { email: 'admin@fashionerp.com' },
  });
  const variants = await variantRepo.find({ where: { companyId: company.id } });
  const customers = await customerRepo.find({
    where: { companyId: company.id },
  });
  const suppliers = await supplierRepo.find({
    where: { companyId: company.id },
  });

  if (!adminUser) {
    throw new Error('Admin user not found. Run create-admin seed first.');
  }
  if (
    branches.length === 0 ||
    warehouses.length === 0 ||
    variants.length === 0
  ) {
    throw new Error(
      'Missing branches, warehouses, or product variants. Run enterprise and bulk seeds first.',
    );
  }

  const branchesByCode = new Map(
    branches.map((branch) => [branch.code, branch]),
  );
  const warehousesByCode = new Map(
    warehouses.map((warehouse) => [warehouse.code, warehouse]),
  );

  await ensureUserCompany(userCompanyRepo, adminUser.id, company.id, true);
  for (const branch of branches) {
    await ensureUserBranch(
      userBranchRepo,
      adminUser.id,
      branch.id,
      branch.code === 'BR-YGN-MAIN',
    );
  }
  for (const warehouse of warehouses) {
    await ensureUserWarehouse(
      userWarehouseRepo,
      adminUser.id,
      warehouse.id,
      warehouse.code === 'WH-YGN-CENTRAL',
    );
  }

  const departmentsByCode = await ensureDepartments(departmentRepo, company.id);
  const designationsByCode = await ensureDesignations(
    designationRepo,
    company.id,
  );
  const customerGroupsByCode = await ensureCustomerGroups(
    customerGroupRepo,
    company.id,
  );
  const supplierGroupsByCode = await ensureSupplierGroups(
    supplierGroupRepo,
    company.id,
  );
  const paymentTermsByCode = await ensurePaymentTerms(
    paymentTermRepo,
    company.id,
  );
  const accountsByCode = await ensureAccountingAccounts(
    accountRepo,
    company.id,
  );
  const paymentMethodsByCode = await ensurePaymentMethods(
    paymentMethodRepo,
    company.id,
    accountsByCode,
  );
  const uomsByCode = await ensureUoms(uomRepo, company.id);
  const priceListsByCode = await ensurePriceLists(priceListRepo, company.id);
  await ensureVariantUomPricing(
    variantRepo,
    variantUomRepo,
    priceListItemRepo,
    variants,
    company.id,
    uomsByCode,
    priceListsByCode,
  );

  await alignExistingCustomers(
    customerRepo,
    customers,
    branches,
    customerGroupsByCode,
    paymentTermsByCode,
    accountsByCode,
  );
  await alignExistingSuppliers(
    supplierRepo,
    suppliers,
    branches,
    supplierGroupsByCode,
    paymentTermsByCode,
    accountsByCode,
  );

  const employees = await ensureEmployees(
    employeeRepo,
    assignmentRepo,
    company.id,
    branchesByCode,
    warehousesByCode,
    departmentsByCode,
    designationsByCode,
    userRepo,
  );

  await ensureSalesAccounts(
    salesAccountRepo,
    salesAccountAssignmentRepo,
    company.id,
    employees,
    adminUser.id,
    branchesByCode,
  );

  const refreshedCustomers = await customerRepo.find({
    where: { companyId: company.id },
  });
  const refreshedSuppliers = await supplierRepo.find({
    where: { companyId: company.id },
  });

  const purchaseOrders = await ensurePurchaseOrders(
    purchaseOrderRepo,
    purchaseOrderItemRepo,
    company.id,
    branches,
    warehouses,
    refreshedSuppliers,
    variants,
    paymentTermsByCode,
    adminUser.id,
  );

  const sales = await ensureSales(
    saleRepo,
    saleItemRepo,
    company.id,
    branches,
    warehouses,
    refreshedCustomers,
    variants,
    adminUser.id,
  );

  await ensurePayments(
    paymentRepo,
    paymentAllocationRepo,
    company.id,
    branches,
    refreshedCustomers,
    refreshedSuppliers,
    paymentMethodsByCode,
    sales,
    purchaseOrders,
    adminUser.id,
  );

  const leaveTypes = await ensureLeaveTypes(leaveTypeRepo, company.id);
  await ensureAttendance(attendanceRepo, employees);
  await ensureLeaveRequests(
    leaveRequestRepo,
    employees,
    leaveTypes,
    adminUser.id,
  );
  const payrollComponentsByCode = await ensurePayrollComponents(
    payrollComponentRepo,
    company.id,
    adminUser.id,
  );
  await ensureEmployeeCompensations(
    compensationRepo,
    company.id,
    employees,
    adminUser.id,
  );
  await ensureEmployeePayrollComponents(
    employeePayrollComponentRepo,
    employees,
    payrollComponentsByCode,
    adminUser.id,
  );
  await ensurePayrollConfiguration(
    payrollConfigurationRepo,
    company.id,
    adminUser.id,
  );
  await ensurePayrollPeriodsAndRuns(
    payrollPeriodRepo,
    payrollPeriodCounterRepo,
    payrollRunRepo,
    payrollRunCounterRepo,
    payrollRunEmployeeRepo,
    payrollRunEmployeeItemRepo,
    employees,
    departmentsByCode,
    designationsByCode,
    payrollComponentsByCode,
    adminUser.id,
    company.id,
  );

  await AppDataSource.destroy();
  logger.log('Linked business data seed complete.');
}

async function ensureDepartments(
  repo: ReturnType<typeof AppDataSource.getRepository<Department>>,
  companyId: string,
): Promise<Map<string, Department>> {
  const map = new Map<string, Department>();
  for (const seed of DEPARTMENTS) {
    let entity = await findSeedRow(repo, [
      { companyId, code: seed.code },
      { companyId, name: seed.name },
    ]);
    if (!entity) {
      entity = repo.create({
        id: uuidv4(),
        companyId,
        code: seed.code,
        name: seed.name,
        description: seed.description ?? null,
        status: DepartmentStatus.Active,
      });
    } else {
      entity.code = seed.code;
      entity.name = seed.name;
      entity.description = seed.description ?? null;
      entity.status = DepartmentStatus.Active;
    }
    entity = await repo.save(entity);
    map.set(seed.code, entity);
  }
  return map;
}

async function ensureDesignations(
  repo: ReturnType<typeof AppDataSource.getRepository<Designation>>,
  companyId: string,
): Promise<Map<string, Designation>> {
  const map = new Map<string, Designation>();
  for (const seed of DESIGNATIONS) {
    let entity = await findSeedRow(repo, [
      { companyId, code: seed.code },
      { companyId, name: seed.name },
    ]);
    if (!entity) {
      entity = repo.create({
        id: uuidv4(),
        companyId,
        code: seed.code,
        name: seed.name,
        description: seed.description ?? null,
        status: DesignationStatus.Active,
      });
    } else {
      entity.code = seed.code;
      entity.name = seed.name;
      entity.description = seed.description ?? null;
      entity.status = DesignationStatus.Active;
    }
    entity = await repo.save(entity);
    map.set(seed.code, entity);
  }
  return map;
}

async function ensureCustomerGroups(
  repo: ReturnType<typeof AppDataSource.getRepository<CustomerGroup>>,
  companyId: string,
): Promise<Map<string, CustomerGroup>> {
  const map = new Map<string, CustomerGroup>();
  for (const seed of CUSTOMER_GROUPS) {
    let entity = await findSeedRow(repo, { companyId, code: seed.code });
    if (!entity) {
      entity = repo.create({
        id: uuidv4(),
        companyId,
        code: seed.code,
        name: seed.name,
        description: seed.description ?? null,
        status: CustomerGroupStatus.Active,
      });
    } else {
      entity.name = seed.name;
      entity.description = seed.description ?? null;
      entity.status = CustomerGroupStatus.Active;
    }
    entity = await repo.save(entity);
    map.set(seed.code, entity);
  }
  return map;
}

async function ensureSupplierGroups(
  repo: ReturnType<typeof AppDataSource.getRepository<SupplierGroup>>,
  companyId: string,
): Promise<Map<string, SupplierGroup>> {
  const map = new Map<string, SupplierGroup>();
  for (const seed of SUPPLIER_GROUPS) {
    let entity = await findSeedRow(repo, { companyId, code: seed.code });
    if (!entity) {
      entity = repo.create({
        id: uuidv4(),
        companyId,
        code: seed.code,
        name: seed.name,
        description: seed.description ?? null,
        status: SupplierGroupStatus.Active,
      });
    } else {
      entity.name = seed.name;
      entity.description = seed.description ?? null;
      entity.status = SupplierGroupStatus.Active;
    }
    entity = await repo.save(entity);
    map.set(seed.code, entity);
  }
  return map;
}

async function ensurePaymentTerms(
  repo: ReturnType<typeof AppDataSource.getRepository<PaymentTerm>>,
  companyId: string,
): Promise<Map<string, PaymentTerm>> {
  const map = new Map<string, PaymentTerm>();
  for (const seed of PAYMENT_TERMS) {
    let entity = await findSeedRow(repo, { companyId, code: seed.code });
    if (!entity) {
      entity = repo.create({
        id: uuidv4(),
        companyId,
        code: seed.code,
        name: seed.name,
        description: seed.description,
        dueDays: seed.dueDays,
        status: PaymentTermStatus.Active,
      });
    } else {
      entity.name = seed.name;
      entity.description = seed.description;
      entity.dueDays = seed.dueDays;
      entity.status = PaymentTermStatus.Active;
    }
    entity = await repo.save(entity);
    map.set(seed.code, entity);
  }
  return map;
}

async function ensurePaymentMethods(
  repo: ReturnType<typeof AppDataSource.getRepository<PaymentMethod>>,
  companyId: string,
  accountsByCode: Map<string, Account>,
): Promise<Map<string, PaymentMethod>> {
  const map = new Map<string, PaymentMethod>();
  const cashAccountId = accountsByCode.get('1100-CASH')?.id ?? null;
  const bankAccountId = accountsByCode.get('1110-BANK')?.id ?? cashAccountId;
  for (const seed of PAYMENT_METHODS) {
    let entity = await findSeedRow(repo, { companyId, code: seed.code });
    const glAccountId = seed.code === 'PM-CASH' ? cashAccountId : bankAccountId;
    if (!entity) {
      entity = repo.create({
        id: uuidv4(),
        companyId,
        code: seed.code,
        name: seed.name,
        status: PaymentMethodStatus.Active,
        glAccountId,
      });
    } else {
      entity.name = seed.name;
      entity.status = PaymentMethodStatus.Active;
      entity.glAccountId = glAccountId;
    }
    entity = await repo.save(entity);
    map.set(seed.code, entity);
  }
  return map;
}

async function ensureUoms(
  repo: ReturnType<typeof AppDataSource.getRepository<Uom>>,
  companyId: string,
): Promise<Map<string, Uom>> {
  const map = new Map<string, Uom>();

  for (const seed of UOM_BLUEPRINTS) {
    let entity = await findSeedRow(repo, [
      { companyId, code: seed.code },
      { companyId, name: seed.name },
    ]);
    if (!entity) {
      entity = repo.create({
        id: uuidv4(),
        companyId,
        code: seed.code,
        name: seed.name,
        symbol: seed.symbol,
        category: seed.category,
        decimalPlaces: seed.decimalPlaces,
        isActive: true,
      });
    } else {
      entity.code = seed.code;
      entity.name = seed.name;
      entity.symbol = seed.symbol;
      entity.category = seed.category;
      entity.decimalPlaces = seed.decimalPlaces;
      entity.isActive = true;
    }

    entity = await repo.save(entity);
    map.set(seed.code, entity);
  }

  return map;
}

async function ensurePriceLists(
  repo: ReturnType<typeof AppDataSource.getRepository<PriceList>>,
  companyId: string,
): Promise<Map<string, PriceList>> {
  const map = new Map<string, PriceList>();

  for (const seed of PRICE_LIST_BLUEPRINTS) {
    let entity = await findSeedRow(repo, [
      { companyId, code: seed.code },
      { companyId, name: seed.name },
    ]);
    if (!entity) {
      entity = repo.create({
        id: uuidv4(),
        companyId,
        code: seed.code,
        name: seed.name,
        description: seed.description,
        currency: seed.currency,
        status: seed.status,
      });
    } else {
      entity.code = seed.code;
      entity.name = seed.name;
      entity.description = seed.description;
      entity.currency = seed.currency;
      entity.status = seed.status;
    }

    entity = await repo.save(entity);
    map.set(seed.code, entity);
  }

  return map;
}

async function ensureVariantUomPricing(
  variantRepo: ReturnType<typeof AppDataSource.getRepository<ProductVariant>>,
  variantUomRepo: ReturnType<typeof AppDataSource.getRepository<ProductVariantUom>>,
  priceListItemRepo: ReturnType<typeof AppDataSource.getRepository<PriceListItem>>,
  variants: ProductVariant[],
  companyId: string,
  uomsByCode: Map<string, Uom>,
  priceListsByCode: Map<string, PriceList>,
): Promise<void> {
  const baseUom = uomsByCode.get('PCS');
  const pack3 = uomsByCode.get('PACK3');
  const pack6 = uomsByCode.get('PACK6');
  const carton12 = uomsByCode.get('CARTON12');
  const retailPriceList = priceListsByCode.get('PL-RETAIL-USD');
  const wholesalePriceList = priceListsByCode.get('PL-WHOLESALE-USD');
  const promoPriceList = priceListsByCode.get('PL-PROMO-USD');

  if (
    !baseUom ||
    !pack3 ||
    !pack6 ||
    !carton12 ||
    !retailPriceList ||
    !wholesalePriceList ||
    !promoPriceList
  ) {
    throw new Error('UOMs or price lists are missing from linked business seed.');
  }

  for (const variant of [...variants].sort((left, right) => left.sku.localeCompare(right.sku))) {
    let currentVariant = variant;
    if (!currentVariant.baseUomId) {
      currentVariant.baseUomId = baseUom.id;
      currentVariant = await variantRepo.save(currentVariant);
    }

    const effectiveBaseUomId = currentVariant.baseUomId ?? baseUom.id;

    await ensureVariantUomMapping(
      variantUomRepo,
      companyId,
      currentVariant.id,
      effectiveBaseUomId,
      '1.0000',
      ProductVariantUomUsageType.Both,
      true,
    );
    await ensureVariantUomMapping(
      variantUomRepo,
      companyId,
      currentVariant.id,
      pack3.id,
      '3.0000',
      ProductVariantUomUsageType.Sales,
      false,
    );
    await ensureVariantUomMapping(
      variantUomRepo,
      companyId,
      currentVariant.id,
      pack6.id,
      '6.0000',
      ProductVariantUomUsageType.Both,
      false,
    );
    await ensureVariantUomMapping(
      variantUomRepo,
      companyId,
      currentVariant.id,
      carton12.id,
      '12.0000',
      ProductVariantUomUsageType.Both,
      false,
    );

    for (const priceList of priceListsByCode.values()) {
      await normalizeLegacyBasePriceRows(
        priceListItemRepo,
        companyId,
        priceList.id,
        currentVariant.id,
        effectiveBaseUomId,
      );
    }

    const basePrice = Number(currentVariant.sellingPrice);
    await upsertPriceListItem(priceListItemRepo, {
      companyId,
      priceListId: retailPriceList.id,
      productVariantId: currentVariant.id,
      uomId: effectiveBaseUomId,
      price: money(basePrice),
      validFrom: CORE_PRICE_VALID_FROM,
      validTo: null,
      status: PriceListItemStatus.Active,
    });
    await upsertPriceListItem(priceListItemRepo, {
      companyId,
      priceListId: retailPriceList.id,
      productVariantId: currentVariant.id,
      uomId: pack3.id,
      price: scaledPrice(basePrice, 3, 0.03),
      validFrom: CORE_PRICE_VALID_FROM,
      validTo: null,
      status: PriceListItemStatus.Active,
    });
    await upsertPriceListItem(priceListItemRepo, {
      companyId,
      priceListId: wholesalePriceList.id,
      productVariantId: currentVariant.id,
      uomId: pack6.id,
      price: scaledPrice(basePrice, 6, 0.1),
      validFrom: CORE_PRICE_VALID_FROM,
      validTo: null,
      status: PriceListItemStatus.Active,
    });
    await upsertPriceListItem(priceListItemRepo, {
      companyId,
      priceListId: wholesalePriceList.id,
      productVariantId: currentVariant.id,
      uomId: carton12.id,
      price: scaledPrice(basePrice, 12, 0.16),
      validFrom: CORE_PRICE_VALID_FROM,
      validTo: null,
      status: PriceListItemStatus.Active,
    });

    if (shouldSeedPromoPrice(currentVariant.sku)) {
      await upsertPriceListItem(priceListItemRepo, {
        companyId,
        priceListId: promoPriceList.id,
        productVariantId: currentVariant.id,
        uomId: effectiveBaseUomId,
        price: scaledPrice(basePrice, 1, 0.12),
        validFrom: PROMO_PRICE_VALID_FROM,
        validTo: PROMO_PRICE_VALID_TO,
        status: PriceListItemStatus.Active,
      });
    }
  }
}

async function ensureVariantUomMapping(
  repo: ReturnType<typeof AppDataSource.getRepository<ProductVariantUom>>,
  companyId: string,
  variantId: string,
  uomId: string,
  conversionFactorToBase: string,
  usageType: ProductVariantUomUsageType,
  isBase: boolean,
): Promise<void> {
  let entity = await findSeedRow(repo, { companyId, variantId, uomId });
  if (!entity) {
    entity = repo.create({
      id: uuidv4(),
      companyId,
      variantId,
      uomId,
      conversionFactorToBase,
      usageType,
      barcode: null,
      isBase,
      isActive: true,
    });
  } else {
    entity.conversionFactorToBase = conversionFactorToBase;
    entity.usageType = usageType;
    entity.barcode = null;
    entity.isBase = isBase;
    entity.isActive = true;
  }

  await repo.save(entity);
}

async function normalizeLegacyBasePriceRows(
  repo: ReturnType<typeof AppDataSource.getRepository<PriceListItem>>,
  companyId: string,
  priceListId: string,
  productVariantId: string,
  baseUomId: string,
): Promise<void> {
  const legacyRows = await repo.find({
    where: {
      companyId,
      priceListId,
      productVariantId,
      uomId: IsNull(),
    },
    withDeleted: true,
    order: { validFrom: 'ASC', createdAt: 'ASC' },
  });

  for (const row of legacyRows) {
    const replacement = await repo.findOne({
      where: {
        companyId,
        priceListId,
        productVariantId,
        uomId: baseUomId,
        validFrom: row.validFrom,
      },
      withDeleted: true,
    });

    if (replacement) {
      replacement.price = row.price;
      replacement.validTo = row.validTo;
      replacement.status = row.status;
      const restorableReplacement = replacement as PriceListItem & {
        deletedAt?: Date | null;
      };
      if (restorableReplacement.deletedAt) {
        restorableReplacement.deletedAt = null;
      }
      await repo.save(replacement);
      if (!(row as PriceListItem & { deletedAt?: Date | null }).deletedAt) {
        await repo.softRemove(row);
      }
      continue;
    }

    row.uomId = baseUomId;
    const restorableRow = row as PriceListItem & { deletedAt?: Date | null };
    if (restorableRow.deletedAt) {
      restorableRow.deletedAt = null;
    }
    await repo.save(row);
  }
}

async function upsertPriceListItem(
  repo: ReturnType<typeof AppDataSource.getRepository<PriceListItem>>,
  seed: {
    companyId: string;
    priceListId: string;
    productVariantId: string;
    uomId: string;
    price: string;
    validFrom: string;
    validTo: string | null;
    status: PriceListItemStatus;
  },
): Promise<void> {
  const validFrom = new Date(seed.validFrom);
  const validTo = seed.validTo ? new Date(seed.validTo) : null;

  let entity = await repo.findOne({
    where: {
      companyId: seed.companyId,
      priceListId: seed.priceListId,
      productVariantId: seed.productVariantId,
      uomId: seed.uomId,
      validFrom,
    },
    withDeleted: true,
  });

  if (!entity) {
    entity = repo.create({
      id: uuidv4(),
      companyId: seed.companyId,
      priceListId: seed.priceListId,
      productVariantId: seed.productVariantId,
      uomId: seed.uomId,
      price: seed.price,
      validFrom,
      validTo,
      status: seed.status,
    });
  } else {
    entity.price = seed.price;
    entity.validTo = validTo;
    entity.status = seed.status;
    const restorableEntity = entity as PriceListItem & { deletedAt?: Date | null };
    if (restorableEntity.deletedAt) {
      restorableEntity.deletedAt = null;
    }
  }

  await repo.save(entity);
}

function scaledPrice(basePrice: number, factor: number, discountRate: number): string {
  return money(basePrice * factor * (1 - discountRate));
}

function shouldSeedPromoPrice(sku: string): boolean {
  const hash = sku
    .split('')
    .reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return hash % 5 === 0;
}

async function ensureAccountingAccounts(
  repo: ReturnType<typeof AppDataSource.getRepository<Account>>,
  companyId: string,
): Promise<Map<string, Account>> {
  const map = new Map<string, Account>();

  for (const seed of ACCOUNT_BLUEPRINTS) {
    let entity = await findSeedRow(repo, { companyId, code: seed.code });
    if (!entity) {
      entity = repo.create({
        id: uuidv4(),
        companyId,
        parentId: null,
        code: seed.code,
        name: seed.name,
        accountType: seed.accountType,
        isActive: true,
        isSystemAccount: true,
      });
    } else {
      entity.name = seed.name;
      entity.accountType = seed.accountType;
      entity.isActive = true;
      entity.isSystemAccount = true;
    }

    entity = await repo.save(entity);
    map.set(seed.code, entity);
  }

  return map;
}

async function alignExistingCustomers(
  repo: ReturnType<typeof AppDataSource.getRepository<Customer>>,
  customers: Customer[],
  branches: Branch[],
  groups: Map<string, CustomerGroup>,
  paymentTerms: Map<string, PaymentTerm>,
  accountsByCode: Map<string, Account>,
): Promise<void> {
  const receivableAccountId = accountsByCode.get('1200-AR')?.id ?? null;
  for (let index = 0; index < customers.length; index++) {
    const customer = customers[index];
    let changed = false;

    if (!customer.branchId && branches.length > 0) {
      customer.branchId = branches[index % branches.length].id;
      changed = true;
    }
    if (!customer.customerGroupId) {
      customer.customerGroupId =
        index % 3 === 0
          ? (groups.get('CG-VIP')?.id ?? null)
          : (groups.get('CG-RETAIL')?.id ?? null);
      changed = true;
    }
    if (!customer.paymentTermId) {
      customer.paymentTermId =
        index % 4 === 0
          ? (paymentTerms.get('PT-NET30')?.id ?? null)
          : (paymentTerms.get('PT-CASH')?.id ?? null);
      changed = true;
    }
    if (customer.displayName === null) {
      customer.displayName = customer.name;
      changed = true;
    }
    if (customer.status !== CustomerStatus.Active) {
      customer.status = CustomerStatus.Active;
      changed = true;
    }
    if (customer.receivableAccountId !== receivableAccountId) {
      customer.receivableAccountId = receivableAccountId;
      changed = true;
    }
    if (changed) {
      await repo.save(customer);
    }
  }
}

async function alignExistingSuppliers(
  repo: ReturnType<typeof AppDataSource.getRepository<Supplier>>,
  suppliers: Supplier[],
  branches: Branch[],
  groups: Map<string, SupplierGroup>,
  paymentTerms: Map<string, PaymentTerm>,
  accountsByCode: Map<string, Account>,
): Promise<void> {
  const payableAccountId = accountsByCode.get('2000-AP')?.id ?? null;
  for (let index = 0; index < suppliers.length; index++) {
    const supplier = suppliers[index];
    let changed = false;

    if (!supplier.branchId && branches.length > 0) {
      supplier.branchId = branches[index % branches.length].id;
      changed = true;
    }
    if (!supplier.supplierGroupId) {
      supplier.supplierGroupId =
        index % 2 === 0
          ? (groups.get('SG-FABRIC')?.id ?? null)
          : (groups.get('SG-GARMENT')?.id ?? null);
      changed = true;
    }
    if (!supplier.paymentTermId) {
      supplier.paymentTermId = paymentTerms.get('PT-NET30')?.id ?? null;
      changed = true;
    }
    if (supplier.displayName === null) {
      supplier.displayName = supplier.name;
      changed = true;
    }
    if (!supplier.country) {
      supplier.country =
        supplier.email?.endsWith('.th')
          ? 'Thailand'
          : supplier.email?.endsWith('.vn')
            ? 'Vietnam'
            : supplier.email?.endsWith('.bd')
              ? 'Bangladesh'
              : supplier.email?.endsWith('.id')
                ? 'Indonesia'
                : supplier.email?.endsWith('.tr')
                  ? 'Turkey'
                  : supplier.email?.endsWith('.it')
                    ? 'Italy'
                    : supplier.email?.endsWith('.cn')
                      ? 'China'
                      : 'Myanmar';
      changed = true;
    }
    if (supplier.status !== SupplierStatus.Active) {
      supplier.status = SupplierStatus.Active;
      changed = true;
    }
    if (supplier.payableAccountId !== payableAccountId) {
      supplier.payableAccountId = payableAccountId;
      changed = true;
    }
    if (changed) {
      await repo.save(supplier);
    }
  }
}

async function ensureEmployees(
  employeeRepo: ReturnType<typeof AppDataSource.getRepository<Employee>>,
  assignmentRepo: ReturnType<
    typeof AppDataSource.getRepository<EmployeeAssignment>
  >,
  companyId: string,
  branchesByCode: Map<string, Branch>,
  warehousesByCode: Map<string, Warehouse>,
  departmentsByCode: Map<string, Department>,
  designationsByCode: Map<string, Designation>,
  userRepo: ReturnType<typeof AppDataSource.getRepository<User>>,
): Promise<Employee[]> {
  const employees: Employee[] = [];

  for (const blueprint of EMPLOYEE_BLUEPRINTS) {
    const branch = branchesByCode.get(blueprint.branchCode);
    const warehouse = warehousesByCode.get(blueprint.warehouseCode);
    const department = departmentsByCode.get(blueprint.departmentCode);
    const designation = designationsByCode.get(blueprint.designationCode);
    const user = blueprint.userEmail
      ? await userRepo.findOne({ where: { email: blueprint.userEmail } })
      : null;

    if (!branch || !warehouse || !department || !designation) {
      throw new Error(
        `Missing branch/warehouse/department/designation for ${blueprint.code}`,
      );
    }

    let employee = await findSeedRow(employeeRepo, {
      companyId,
      employeeCode: blueprint.code,
    });

    if (!employee) {
      employee = employeeRepo.create({
        id: uuidv4(),
        companyId,
        branchId: branch.id,
        employeeCode: blueprint.code,
        firstName: blueprint.firstName,
        lastName: blueprint.lastName,
        displayName: `${blueprint.firstName} ${blueprint.lastName}`,
        phone: `+95977${Math.floor(100000 + Math.random() * 899999)}`,
        email: `${blueprint.firstName.toLowerCase()}.${blueprint.lastName.toLowerCase()}@fashionenterprise.com`,
        userId: user?.id ?? null,
        status: EmployeeStatus.Active,
        joinedAt: new Date('2026-01-15T09:00:00.000Z'),
      });
    } else {
      employee.branchId = branch.id;
      employee.userId = user?.id ?? employee.userId;
      employee.status = EmployeeStatus.Active;
    }

    employee = await employeeRepo.save(employee);
    employees.push(employee);

    let assignment = await findSeedRow(assignmentRepo, {
      employeeId: employee.id,
      companyId,
      branchId: branch.id,
      status: EmployeeAssignmentStatus.Active,
    });

    if (!assignment) {
      assignment = assignmentRepo.create({
        id: uuidv4(),
        employeeId: employee.id,
        companyId,
        branchId: branch.id,
        departmentId: department.id,
        designationId: designation.id,
        warehouseId: warehouse.id,
        effectiveFrom: '2026-01-15',
        effectiveTo: null,
        status: EmployeeAssignmentStatus.Active,
      });
    } else {
      assignment.departmentId = department.id;
      assignment.designationId = designation.id;
      assignment.warehouseId = warehouse.id;
    }

    await assignmentRepo.save(assignment);
  }

  return employees;
}

async function ensureSalesAccounts(
  salesAccountRepo: ReturnType<
    typeof AppDataSource.getRepository<SalesAccount>
  >,
  assignmentRepo: ReturnType<
    typeof AppDataSource.getRepository<SalesAccountAssignment>
  >,
  companyId: string,
  employees: Employee[],
  adminUserId: string,
  branchesByCode: Map<string, Branch>,
): Promise<void> {
  for (const employee of employees.slice(0, 2)) {
    const branch = Array.from(branchesByCode.values()).find(
      (item) => item.id === employee.branchId,
    );
    if (!branch) continue;

    const code = `SA-${employee.employeeCode}`;
    let salesAccount = await findSeedRow(salesAccountRepo, {
      companyId,
      code,
    });

    if (!salesAccount) {
      salesAccount = salesAccountRepo.create({
        id: uuidv4(),
        companyId,
        branchId: branch.id,
        employeeId: employee.id,
        code,
        name: `${employee.displayName} Sales Desk`,
        status: SalesAccountStatus.Active,
      });
    } else {
      salesAccount.branchId = branch.id;
      salesAccount.employeeId = employee.id;
      salesAccount.status = SalesAccountStatus.Active;
    }

    salesAccount = await salesAccountRepo.save(salesAccount);

    let assignment = await findSeedRow(assignmentRepo, {
      userId: adminUserId,
      employeeId: employee.id,
      salesAccountId: salesAccount.id,
    });

    if (!assignment) {
      assignment = assignmentRepo.create({
        id: uuidv4(),
        userId: adminUserId,
        employeeId: employee.id,
        salesAccountId: salesAccount.id,
        status: SalesAccountAssignmentStatus.Active,
        isPrimary: employee.employeeCode === 'EMP-1001',
        assignedAt: new Date('2026-02-01T09:00:00.000Z'),
        unassignedAt: null,
      });
    } else {
      assignment.status = SalesAccountAssignmentStatus.Active;
      assignment.isPrimary = employee.employeeCode === 'EMP-1001';
      assignment.unassignedAt = null;
    }

    await assignmentRepo.save(assignment);
  }
}

async function ensurePurchaseOrders(
  poRepo: ReturnType<typeof AppDataSource.getRepository<PurchaseOrder>>,
  itemRepo: ReturnType<typeof AppDataSource.getRepository<PurchaseOrderItem>>,
  companyId: string,
  branches: Branch[],
  warehouses: Warehouse[],
  suppliers: Supplier[],
  variants: ProductVariant[],
  paymentTerms: Map<string, PaymentTerm>,
  adminUserId: string,
): Promise<PurchaseOrder[]> {
  const created: PurchaseOrder[] = [];
  if (suppliers.length === 0 || variants.length === 0) return created;

  const groups = chunk(variants.slice(0, 9), 3);
  for (let index = 0; index < groups.length; index++) {
    const number = `PO-2026-${String(index + 101).padStart(4, '0')}`;
    const branch = branches[index % branches.length];
    const warehouse = warehouses[index % warehouses.length];
    const supplier = suppliers[index % suppliers.length];
    const items = groups[index];
    const subtotalValue = items.reduce(
      (sum, variant, itemIndex) =>
        sum + Number(variant.costPrice) * (itemIndex + 2),
      0,
    );
    const taxValue = subtotalValue * 0.05;
    const grandTotal = subtotalValue + taxValue;

    let order = await findSeedRow(poRepo, {
      companyId,
      purchaseOrderNumber: number,
    });

    if (!order) {
      order = poRepo.create({
        id: uuidv4(),
        purchaseOrderNumber: number,
        purchaseType:
          index % 2 === 0 ? PurchaseType.Standard : PurchaseType.Credit,
        supplierId: supplier.id,
        companyId,
        branchId: branch.id,
        warehouseId: warehouse.id,
        paymentTermId: paymentTerms.get('PT-NET30')?.id ?? null,
        transactionDate: new Date(
          `2026-03-${String(index + 1).padStart(2, '0')}T08:00:00.000Z`,
        ),
        expectedDeliveryDate: new Date(
          `2026-03-${String(index + 5).padStart(2, '0')}T08:00:00.000Z`,
        ),
        status: PurchaseOrderStatus.Confirmed,
        subtotal: money(subtotalValue),
        discountAmount: '0.00',
        taxAmount: money(taxValue),
        grandTotal: money(grandTotal),
        paidAmount: '0.00',
        balanceAmount: money(grandTotal),
        currency: PRICE_CURRENCY,
        notes: 'Linked seed purchase order',
        createdBy: adminUserId,
        updatedBy: adminUserId,
      });
      order = await poRepo.save(order);
    }

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      const variant = items[itemIndex];
      const existing = await findSeedRow(itemRepo, {
        purchaseOrderId: order.id,
        productVariantId: variant.id,
      });
      if (existing) continue;

      const quantity = itemIndex + 2;
      const unitCost = Number(variant.costPrice);
      const lineSubtotal = unitCost * quantity;
      const lineTax = unitCost * 0.05;
      await itemRepo.save(
        itemRepo.create({
          id: uuidv4(),
          purchaseOrderId: order.id,
          productVariantId: variant.id,
          quantity,
          unitCostSnapshot: money(unitCost),
          discountSnapshot: '0.00',
          taxSnapshot: money(lineTax),
          lineTotal: money(lineSubtotal + lineTax),
          productNameSnapshot: variant.sku,
          skuSnapshot: variant.sku,
        }),
      );
    }

    created.push(order);
  }

  return created;
}

async function ensureSales(
  saleRepo: ReturnType<typeof AppDataSource.getRepository<Sale>>,
  itemRepo: ReturnType<typeof AppDataSource.getRepository<SaleItem>>,
  companyId: string,
  branches: Branch[],
  warehouses: Warehouse[],
  customers: Customer[],
  variants: ProductVariant[],
  adminUserId: string,
): Promise<Sale[]> {
  const created: Sale[] = [];
  if (customers.length === 0 || variants.length === 0) return created;

  const groups = chunk(variants.slice(0, 12), 3);
  for (let index = 0; index < groups.length; index++) {
    const number = `SO-LINK-${String(index + 2001).padStart(4, '0')}`;
    const branch = branches[index % branches.length];
    const warehouse = warehouses[index % warehouses.length];
    const customer = customers[index % customers.length];
    const items = groups[index];
    const subtotalValue = items.reduce(
      (sum, variant, itemIndex) =>
        sum + Number(variant.sellingPrice) * (itemIndex + 1),
      0,
    );
    const taxValue = subtotalValue * 0.05;
    const grandTotal = subtotalValue + taxValue;

    let sale = await findSeedRow(saleRepo, {
      companyId,
      saleNumber: number,
    });

    if (!sale) {
      sale = saleRepo.create({
        id: uuidv4(),
        companyId,
        branchId: branch.id,
        warehouseId: warehouse.id,
        saleNumber: number,
        saleType: index % 2 === 0 ? SaleType.Pos : SaleType.Retail,
        customerId: customer.id,
        transactionDate: new Date(
          `2026-04-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`,
        ),
        status: SaleStatus.Confirmed,
        subtotal: money(subtotalValue),
        discountAmount: '0.00',
        taxAmount: money(taxValue),
        grandTotal: money(grandTotal),
        paidAmount: money(grandTotal),
        balanceAmount: '0.00',
        currency: PRICE_CURRENCY,
        notes: 'Linked seed sale order',
        createdBy: adminUserId,
        updatedBy: adminUserId,
      });
      sale = await saleRepo.save(sale);
    }

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      const variant = items[itemIndex];
      const existing = await findSeedRow(itemRepo, {
        saleId: sale.id,
        productVariantId: variant.id,
      });
      if (existing) continue;

      const quantity = itemIndex + 1;
      const unitPrice = Number(variant.sellingPrice);
      const lineTax = unitPrice * 0.05;
      await itemRepo.save(
        itemRepo.create({
          id: uuidv4(),
          saleId: sale.id,
          productVariantId: variant.id,
          quantity,
          unitPriceSnapshot: money(unitPrice),
          discountSnapshot: '0.00',
          taxSnapshot: money(lineTax),
          lineTotal: money(unitPrice * quantity + lineTax),
          productNameSnapshot: variant.sku,
          skuSnapshot: variant.sku,
        }),
      );
    }

    created.push(sale);
  }

  return created;
}

async function ensurePayments(
  paymentRepo: ReturnType<typeof AppDataSource.getRepository<Payment>>,
  allocationRepo: ReturnType<
    typeof AppDataSource.getRepository<PaymentAllocation>
  >,
  companyId: string,
  branches: Branch[],
  customers: Customer[],
  suppliers: Supplier[],
  paymentMethods: Map<string, PaymentMethod>,
  sales: Sale[],
  purchaseOrders: PurchaseOrder[],
  adminUserId: string,
): Promise<void> {
  const cashMethod = paymentMethods.get('PM-CASH');
  const bankMethod = paymentMethods.get('PM-BANK') ?? cashMethod;
  if (!cashMethod || !bankMethod) return;

  for (let index = 0; index < Math.min(3, sales.length); index++) {
    const sale = sales[index];
    const branch =
      branches.find((item) => item.id === sale.branchId) ?? branches[0];
    const paymentNumber = `PAY-RCPT-${String(index + 1).padStart(4, '0')}`;
    let payment = await findSeedRow(paymentRepo, {
      companyId,
      paymentNumber,
    });

    if (!payment) {
      payment = paymentRepo.create({
        id: uuidv4(),
        paymentNumber,
        companyId,
        branchId: branch?.id ?? null,
        direction: PaymentDirection.Receipt,
        customerId: sale.customerId,
        supplierId: null,
        paymentMethodId: cashMethod.id,
        amount: sale.grandTotal,
        currency: sale.currency,
        reference: sale.saleNumber,
        idempotencyKey: `seed-receipt-${sale.id}`,
        status: PaymentStatus.Confirmed,
        paymentDate: sale.transactionDate,
        notes: 'Linked seed payment receipt',
        createdBy: adminUserId,
        updatedBy: adminUserId,
      });
      payment = await paymentRepo.save(payment);
    }

    await ensurePaymentAllocation(
      allocationRepo,
      payment.id,
      PaymentReferenceType.Sale,
      sale.id,
      sale.grandTotal,
    );
  }

  for (let index = 0; index < Math.min(2, purchaseOrders.length); index++) {
    const order = purchaseOrders[index];
    const paymentNumber = `PAY-SUP-${String(index + 1).padStart(4, '0')}`;
    let payment = await findSeedRow(paymentRepo, {
      companyId,
      paymentNumber,
    });

    if (!payment) {
      payment = paymentRepo.create({
        id: uuidv4(),
        paymentNumber,
        companyId,
        branchId: order.branchId,
        direction: PaymentDirection.Payment,
        customerId: null,
        supplierId: order.supplierId,
        paymentMethodId: bankMethod.id,
        amount: money(Number(order.grandTotal) / 2),
        currency: order.currency,
        reference: order.purchaseOrderNumber,
        idempotencyKey: `seed-supplier-payment-${order.id}`,
        status: PaymentStatus.Confirmed,
        paymentDate: order.transactionDate,
        notes: 'Linked seed supplier payment',
        createdBy: adminUserId,
        updatedBy: adminUserId,
      });
      payment = await paymentRepo.save(payment);
    }

    await ensurePaymentAllocation(
      allocationRepo,
      payment.id,
      PaymentReferenceType.PurchaseOrder,
      order.id,
      money(Number(order.grandTotal) / 2),
    );
  }
}

async function ensurePaymentAllocation(
  repo: ReturnType<typeof AppDataSource.getRepository<PaymentAllocation>>,
  paymentId: string,
  referenceType: PaymentReferenceType,
  referenceId: string,
  allocatedAmount: string,
): Promise<void> {
  const existing = await findSeedRow(repo, {
    paymentId,
    referenceType,
    referenceId,
  });
  if (existing) return;

  await repo.save(
    repo.create({
      id: uuidv4(),
      paymentId,
      referenceType,
      referenceId,
      allocatedAmount,
    }),
  );
}

async function ensureLeaveTypes(
  repo: ReturnType<typeof AppDataSource.getRepository<LeaveType>>,
  companyId: string,
): Promise<LeaveType[]> {
  const defs = [
    {
      code: 'LT-ANNUAL',
      name: 'Annual Leave',
      description: 'Paid annual vacation leave',
      isPaid: true,
      defaultDays: '12.00',
    },
    {
      code: 'LT-SICK',
      name: 'Sick Leave',
      description: 'Medical and health leave',
      isPaid: true,
      defaultDays: '10.00',
    },
  ];

  const result: LeaveType[] = [];
  for (const seed of defs) {
    let entity = await findSeedRow(repo, [
      { companyId, code: seed.code },
      { companyId, name: seed.name },
    ]);
    if (!entity) {
      entity = repo.create({
        id: uuidv4(),
        companyId,
        code: seed.code,
        name: seed.name,
        description: seed.description,
        isPaid: seed.isPaid,
        defaultDays: seed.defaultDays,
        status: LeaveTypeStatus.Active,
      });
    } else {
      entity.code = seed.code;
      entity.name = seed.name;
      entity.description = seed.description;
      entity.isPaid = seed.isPaid;
      entity.defaultDays = seed.defaultDays;
      entity.status = LeaveTypeStatus.Active;
    }
    result.push(await repo.save(entity));
  }

  return result;
}

async function ensureAttendance(
  repo: ReturnType<typeof AppDataSource.getRepository<AttendanceRecord>>,
  employees: Employee[],
): Promise<void> {
  for (const employee of employees) {
    for (let offset = 1; offset <= 3; offset++) {
      const attendanceDate = isoDateDaysAgo(offset);
      const existing = await findSeedRow(repo, {
        employeeId: employee.id,
        attendanceDate,
      });
      if (existing) continue;

      await repo.save(
        repo.create({
          id: uuidv4(),
          employeeId: employee.id,
          companyId: employee.companyId,
          branchId: employee.branchId,
          attendanceDate,
          status:
            offset === 2 ? AttendanceStatus.Late : AttendanceStatus.Present,
          checkInAt:
            offset === 2
              ? new Date(`${attendanceDate}T09:20:00.000Z`)
              : new Date(`${attendanceDate}T09:00:00.000Z`),
          checkOutAt: new Date(`${attendanceDate}T18:00:00.000Z`),
          note: 'Seeded attendance record',
        }),
      );
    }
  }
}

async function ensureLeaveRequests(
  repo: ReturnType<typeof AppDataSource.getRepository<LeaveRequest>>,
  employees: Employee[],
  leaveTypes: LeaveType[],
  adminUserId: string,
): Promise<void> {
  if (employees.length === 0 || leaveTypes.length === 0) return;

  const targetEmployee = employees[1] ?? employees[0];
  const annualLeave = leaveTypes[0];
  const existing = await findSeedRow(repo, {
    employeeId: targetEmployee.id,
    leaveTypeId: annualLeave.id,
    fromDate: '2026-08-10',
    toDate: '2026-08-11',
  });

  if (existing) return;

  await repo.save(
    repo.create({
      id: uuidv4(),
      employeeId: targetEmployee.id,
      companyId: targetEmployee.companyId,
      branchId: targetEmployee.branchId,
      leaveTypeId: annualLeave.id,
      fromDate: '2026-08-10',
      toDate: '2026-08-11',
      reason: 'Seeded leave request for realistic HR workflow data',
      status: LeaveRequestStatus.Approved,
      approvedByUserId: adminUserId,
      rejectedByUserId: null,
      decisionAt: new Date('2026-08-08T10:00:00.000Z'),
      cancelledAt: null,
    }),
  );
}

function decimalToCents(value: string | null | undefined): number {
  if (!value) return 0;
  return Math.round(Number(value) * 100);
}

function centsToMoney(value: number): string {
  return (value / 100).toFixed(2);
}

async function ensurePayrollComponents(
  repo: ReturnType<typeof AppDataSource.getRepository<PayrollComponent>>,
  companyId: string,
  adminUserId: string,
): Promise<Map<string, PayrollComponent>> {
  const map = new Map<string, PayrollComponent>();

  for (const seed of PAYROLL_COMPONENT_BLUEPRINTS) {
    let entity = await findSeedRow(repo, { companyId, code: seed.code });
    if (!entity) {
      entity = repo.create({
        id: uuidv4(),
        companyId,
        code: seed.code,
        name: seed.name,
        type: seed.type,
        calculationType: seed.calculationType,
        fixedAmount: seed.fixedAmount,
        percentage: seed.percentage,
        isTaxable: seed.isTaxable,
        isActive: true,
        createdBy: adminUserId,
        updatedBy: adminUserId,
      });
    } else {
      entity.code = seed.code;
      entity.name = seed.name;
      entity.type = seed.type;
      entity.calculationType = seed.calculationType;
      entity.fixedAmount = seed.fixedAmount;
      entity.percentage = seed.percentage;
      entity.isTaxable = seed.isTaxable;
      entity.isActive = true;
      entity.updatedBy = adminUserId;
      entity.createdBy ??= adminUserId;
    }

    map.set(seed.code, await repo.save(entity));
  }

  return map;
}

async function ensureEmployeeCompensations(
  repo: ReturnType<typeof AppDataSource.getRepository<EmployeeCompensation>>,
  companyId: string,
  employees: Employee[],
  adminUserId: string,
): Promise<void> {
  const employeesByCode = new Map(
    employees.map((employee) => [employee.employeeCode, employee]),
  );

  for (const seed of PAYROLL_COMPENSATION_BLUEPRINTS) {
    const employee = employeesByCode.get(seed.employeeCode);
    if (!employee) continue;

    let entity = await findSeedRow(repo, {
      employeeId: employee.id,
      effectiveFrom: '2026-01-15',
    });
    if (!entity) {
      entity = repo.create({
        id: uuidv4(),
        companyId,
        employeeId: employee.id,
        effectiveFrom: '2026-01-15',
        effectiveTo: null,
        baseSalary: seed.baseSalary,
        currency: PRICE_CURRENCY,
        payFrequency: PayFrequency.Monthly,
        createdBy: adminUserId,
        updatedBy: adminUserId,
      });
    } else {
      entity.companyId = companyId;
      entity.employeeId = employee.id;
      entity.effectiveFrom = '2026-01-15';
      entity.effectiveTo = null;
      entity.baseSalary = seed.baseSalary;
      entity.currency = PRICE_CURRENCY;
      entity.payFrequency = PayFrequency.Monthly;
      entity.updatedBy = adminUserId;
      entity.createdBy ??= adminUserId;
    }

    await repo.save(entity);
  }
}

async function ensureEmployeePayrollComponents(
  repo: ReturnType<typeof AppDataSource.getRepository<EmployeePayrollComponent>>,
  employees: Employee[],
  componentsByCode: Map<string, PayrollComponent>,
  adminUserId: string,
): Promise<void> {
  const employeesByCode = new Map(
    employees.map((employee) => [employee.employeeCode, employee]),
  );

  for (const seed of EMPLOYEE_PAYROLL_COMPONENT_BLUEPRINTS) {
    const employee = employeesByCode.get(seed.employeeCode);
    const component = componentsByCode.get(seed.componentCode);
    if (!employee || !component) continue;

    const assignmentAmount = 'amount' in seed ? seed.amount : undefined;

    let entity = await findSeedRow(repo, {
      employeeId: employee.id,
      payrollComponentId: component.id,
      effectiveFrom: '2026-01-15',
    });
    if (!entity) {
      entity = repo.create({
        id: uuidv4(),
        employeeId: employee.id,
        payrollComponentId: component.id,
        amount: assignmentAmount ?? null,
        percentage: null,
        effectiveFrom: '2026-01-15',
        effectiveTo: null,
        createdBy: adminUserId,
      });
    } else {
      entity.employeeId = employee.id;
      entity.payrollComponentId = component.id;
      entity.amount = assignmentAmount ?? null;
      entity.percentage = null;
      entity.effectiveFrom = '2026-01-15';
      entity.effectiveTo = null;
      entity.createdBy ??= adminUserId;
    }

    await repo.save(entity);
  }
}

async function ensurePayrollConfiguration(
  repo: ReturnType<typeof AppDataSource.getRepository<PayrollConfiguration>>,
  companyId: string,
  adminUserId: string,
): Promise<void> {
  let entity = await findSeedRow(repo, { companyId });
  if (!entity) {
    entity = repo.create({
      id: uuidv4(),
      companyId,
      defaultCurrency: PRICE_CURRENCY,
      unpaidLeaveCalculation: UnpaidLeaveCalculation.DailyRate,
      workingDaysPerMonth: 22,
      createdBy: adminUserId,
      updatedBy: adminUserId,
    });
  } else {
    entity.defaultCurrency = PRICE_CURRENCY;
    entity.unpaidLeaveCalculation = UnpaidLeaveCalculation.DailyRate;
    entity.workingDaysPerMonth = 22;
    entity.updatedBy = adminUserId;
    entity.createdBy ??= adminUserId;
  }

  await repo.save(entity);
}

async function ensurePayrollPeriodsAndRuns(
  periodRepo: ReturnType<typeof AppDataSource.getRepository<PayrollPeriod>>,
  periodCounterRepo: ReturnType<
    typeof AppDataSource.getRepository<CompanyPayrollPeriodCounter>
  >,
  runRepo: ReturnType<typeof AppDataSource.getRepository<PayrollRun>>,
  runCounterRepo: ReturnType<
    typeof AppDataSource.getRepository<CompanyPayrollRunCounter>
  >,
  runEmployeeRepo: ReturnType<
    typeof AppDataSource.getRepository<PayrollRunEmployee>
  >,
  runEmployeeItemRepo: ReturnType<
    typeof AppDataSource.getRepository<PayrollRunEmployeeItem>
  >,
  employees: Employee[],
  departmentsByCode: Map<string, Department>,
  designationsByCode: Map<string, Designation>,
  componentsByCode: Map<string, PayrollComponent>,
  adminUserId: string,
  companyId: string,
): Promise<void> {
  let periodCounter = await periodCounterRepo.findOne({
    where: { companyId, year: 2026 },
  });
  if (!periodCounter) {
    periodCounter = periodCounterRepo.create({
      companyId,
      year: 2026,
      lastSequence: PAYROLL_PERIOD_BLUEPRINTS.length,
    });
  } else {
    periodCounter.lastSequence = Math.max(
      periodCounter.lastSequence,
      PAYROLL_PERIOD_BLUEPRINTS.length,
    );
  }
  await periodCounterRepo.save(periodCounter);

  let runCounter = await runCounterRepo.findOne({
    where: { companyId, year: 2026 },
  });
  if (!runCounter) {
    runCounter = runCounterRepo.create({
      companyId,
      year: 2026,
      lastSequence: 1,
    });
  } else {
    runCounter.lastSequence = Math.max(runCounter.lastSequence, 1);
  }
  await runCounterRepo.save(runCounter);

  const employeesByCode = new Map(
    employees.map((employee) => [employee.employeeCode, employee]),
  );
  const departmentNameByEmployeeCode = new Map<string, string | null>();
  const designationNameByEmployeeCode = new Map<string, string | null>();
  for (const blueprint of EMPLOYEE_BLUEPRINTS) {
    departmentNameByEmployeeCode.set(
      blueprint.code,
      departmentsByCode.get(blueprint.departmentCode)?.name ?? null,
    );
    designationNameByEmployeeCode.set(
      blueprint.code,
      designationsByCode.get(blueprint.designationCode)?.name ?? null,
    );
  }

  const periodByNumber = new Map<string, PayrollPeriod>();
  for (const seed of PAYROLL_PERIOD_BLUEPRINTS) {
    let period = await findSeedRow(periodRepo, { companyId, periodNumber: seed.periodNumber });
    if (!period) {
      period = periodRepo.create({
        id: uuidv4(),
        companyId,
        periodNumber: seed.periodNumber,
        name: seed.name,
        startDate: seed.startDate,
        endDate: seed.endDate,
        payDate: seed.payDate,
        status: seed.status,
        createdBy: adminUserId,
        updatedBy: adminUserId,
      });
    } else {
      period.name = seed.name;
      period.startDate = seed.startDate;
      period.endDate = seed.endDate;
      period.payDate = seed.payDate;
      period.status = seed.status;
      period.updatedBy = adminUserId;
      period.createdBy ??= adminUserId;
    }

    periodByNumber.set(seed.periodNumber, await periodRepo.save(period));
  }

  const finalizedPeriod = periodByNumber.get('PP-2026-000001');
  if (!finalizedPeriod) return;

  let run = await findSeedRow(runRepo, {
    companyId,
    payrollPeriodId: finalizedPeriod.id,
  });
  if (!run) {
    run = runRepo.create({
      id: uuidv4(),
      companyId,
      payrollPeriodId: finalizedPeriod.id,
      runNumber: 'PR-2026-000001',
      status: PayrollRunStatus.Finalized,
      employeeCount: 0,
      totalGrossPay: '0.00',
      totalDeductions: '0.00',
      totalNetPay: '0.00',
      startedAt: new Date('2026-08-04T09:00:00.000Z'),
      completedAt: new Date('2026-08-04T09:15:00.000Z'),
      finalizedAt: new Date('2026-08-05T09:00:00.000Z'),
      createdBy: adminUserId,
      finalizedBy: adminUserId,
    });
  } else {
    run.runNumber = 'PR-2026-000001';
    run.status = PayrollRunStatus.Finalized;
    run.startedAt = new Date('2026-08-04T09:00:00.000Z');
    run.completedAt = new Date('2026-08-04T09:15:00.000Z');
    run.finalizedAt = new Date('2026-08-05T09:00:00.000Z');
    run.finalizedBy = adminUserId;
    run.createdBy ??= adminUserId;
  }
  run = await runRepo.save(run);

  const compensationByEmployeeCode = new Map(
    PAYROLL_COMPENSATION_BLUEPRINTS.map((seed) => [seed.employeeCode, seed]),
  );
  const assignmentsByEmployeeCode = new Map<
    string,
    (typeof EMPLOYEE_PAYROLL_COMPONENT_BLUEPRINTS)[number][]
  >();
  for (const assignment of EMPLOYEE_PAYROLL_COMPONENT_BLUEPRINTS) {
    const existing = assignmentsByEmployeeCode.get(assignment.employeeCode) ?? [];
    existing.push(assignment);
    assignmentsByEmployeeCode.set(assignment.employeeCode, existing);
  }

  let totalGrossCents = 0;
  let totalDeductionCents = 0;
  let totalNetCents = 0;
  let seededEmployeeCount = 0;

  const runEmployeesToSeed: Array<{
    entity: PayrollRunEmployee;
    items: Array<{
      payrollComponentId: string;
      componentNameSnapshot: string;
      componentCodeSnapshot: string;
      type: PayrollComponentType;
      calculationTypeSnapshot: PayrollCalculationType;
      amount: string;
    }>;
  }> = [];

  for (const [employeeCode, compensation] of compensationByEmployeeCode) {
    const employee = employeesByCode.get(employeeCode);
    if (!employee) continue;

    const baseSalaryCents = decimalToCents(compensation.baseSalary);
    const assignmentSeeds = assignmentsByEmployeeCode.get(employeeCode) ?? [];
    const items = assignmentSeeds
      .map((assignment) => {
        const component = componentsByCode.get(assignment.componentCode);
        if (!component) return null;

        const assignmentAmount =
          'amount' in assignment ? assignment.amount : undefined;

        let amountCents = 0;
        if (assignmentAmount) {
          amountCents = decimalToCents(assignmentAmount);
        } else if (component.fixedAmount) {
          amountCents = decimalToCents(component.fixedAmount);
        } else if (component.percentage) {
          amountCents = Math.round(
            (baseSalaryCents * Number(component.percentage)) / 100,
          );
        }

        return {
          payrollComponentId: component.id,
          componentNameSnapshot: component.name,
          componentCodeSnapshot: component.code,
          type: component.type,
          calculationTypeSnapshot: component.calculationType,
          amountCents,
        };
      })
      .filter(
        (
          item,
        ): item is {
          payrollComponentId: string;
          componentNameSnapshot: string;
          componentCodeSnapshot: string;
          type: PayrollComponentType;
          calculationTypeSnapshot: PayrollCalculationType;
          amountCents: number;
        } => item !== null,
      );

    const grossCents =
      baseSalaryCents +
      items
        .filter((item) => item.type === PayrollComponentType.Earning)
        .reduce((sum, item) => sum + item.amountCents, 0);
    const deductionCents = items
      .filter((item) => item.type === PayrollComponentType.Deduction)
      .reduce((sum, item) => sum + item.amountCents, 0);
    const netCents = grossCents - deductionCents;

    totalGrossCents += grossCents;
    totalDeductionCents += deductionCents;
    totalNetCents += netCents;
    seededEmployeeCount += 1;

    let runEmployee = await findSeedRow(runEmployeeRepo, {
      payrollRunId: run.id,
      employeeId: employee.id,
    });
    if (!runEmployee) {
      runEmployee = runEmployeeRepo.create({
        id: uuidv4(),
        payrollRunId: run.id,
        employeeId: employee.id,
        employeeCodeSnapshot: employee.employeeCode,
        employeeNameSnapshot: employee.displayName,
        departmentSnapshot:
          departmentNameByEmployeeCode.get(employeeCode) ?? null,
        designationSnapshot:
          designationNameByEmployeeCode.get(employeeCode) ?? null,
        baseSalarySnapshot: compensation.baseSalary,
        grossPay: centsToMoney(grossCents),
        totalDeductions: centsToMoney(deductionCents),
        netPay: centsToMoney(netCents),
        status: PayrollRunEmployeeStatus.Finalized,
      });
    } else {
      runEmployee.employeeCodeSnapshot = employee.employeeCode;
      runEmployee.employeeNameSnapshot = employee.displayName;
      runEmployee.departmentSnapshot =
        departmentNameByEmployeeCode.get(employeeCode) ?? null;
      runEmployee.designationSnapshot =
        designationNameByEmployeeCode.get(employeeCode) ?? null;
      runEmployee.baseSalarySnapshot = compensation.baseSalary;
      runEmployee.grossPay = centsToMoney(grossCents);
      runEmployee.totalDeductions = centsToMoney(deductionCents);
      runEmployee.netPay = centsToMoney(netCents);
      runEmployee.status = PayrollRunEmployeeStatus.Finalized;
    }

    runEmployeesToSeed.push({
      entity: await runEmployeeRepo.save(runEmployee),
      items: items.map((item) => ({
        payrollComponentId: item.payrollComponentId,
        componentNameSnapshot: item.componentNameSnapshot,
        componentCodeSnapshot: item.componentCodeSnapshot,
        type: item.type,
        calculationTypeSnapshot: item.calculationTypeSnapshot,
        amount: centsToMoney(item.amountCents),
      })),
    });
  }

  run.employeeCount = seededEmployeeCount;
  run.totalGrossPay = centsToMoney(totalGrossCents);
  run.totalDeductions = centsToMoney(totalDeductionCents);
  run.totalNetPay = centsToMoney(totalNetCents);
  run = await runRepo.save(run);

  for (const seeded of runEmployeesToSeed) {
    await runEmployeeItemRepo.delete({
      payrollRunEmployeeId: seeded.entity.id,
    });
    for (const item of seeded.items) {
      await runEmployeeItemRepo.save(
        runEmployeeItemRepo.create({
          payrollRunEmployeeId: seeded.entity.id,
          payrollComponentId: item.payrollComponentId,
          componentNameSnapshot: item.componentNameSnapshot,
          componentCodeSnapshot: item.componentCodeSnapshot,
          type: item.type,
          calculationTypeSnapshot: item.calculationTypeSnapshot,
          amount: item.amount,
        }),
      );
    }
  }
}

async function ensureUserCompany(
  repo: ReturnType<typeof AppDataSource.getRepository<UserCompany>>,
  userId: string,
  companyId: string,
  isPrimary: boolean,
): Promise<void> {
  let entity = await findSeedRow(repo, { userId, companyId });
  if (!entity) {
    entity = repo.create({
      id: uuidv4(),
      userId,
      companyId,
      status: MembershipStatus.Active,
      isPrimary,
    });
  } else {
    entity.status = MembershipStatus.Active;
    entity.isPrimary = isPrimary;
  }
  await repo.save(entity);
}

async function ensureUserBranch(
  repo: ReturnType<typeof AppDataSource.getRepository<UserBranch>>,
  userId: string,
  branchId: string,
  isPrimary: boolean,
): Promise<void> {
  let entity = await findSeedRow(repo, { userId, branchId });
  if (!entity) {
    entity = repo.create({
      id: uuidv4(),
      userId,
      branchId,
      status: MembershipStatus.Active,
      isPrimary,
    });
  } else {
    entity.status = MembershipStatus.Active;
    entity.isPrimary = isPrimary;
  }
  await repo.save(entity);
}

async function ensureUserWarehouse(
  repo: ReturnType<typeof AppDataSource.getRepository<UserWarehouse>>,
  userId: string,
  warehouseId: string,
  isPrimary: boolean,
): Promise<void> {
  let entity = await findSeedRow(repo, { userId, warehouseId });
  if (!entity) {
    entity = repo.create({
      id: uuidv4(),
      userId,
      warehouseId,
      status: MembershipStatus.Active,
      isPrimary,
    });
  } else {
    entity.status = MembershipStatus.Active;
    entity.isPrimary = isPrimary;
  }
  await repo.save(entity);
}

seedLinkedBusinessData().catch((error: unknown) => {
  logScriptFailure('Linked business data seed failed.', error, logger);
  process.exit(1);
});
