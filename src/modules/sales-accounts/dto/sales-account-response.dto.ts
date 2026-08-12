import { SalesAccount } from '../entities/sales-account.entity';
import { SalesAccountStatus } from '../entities/sales-account-status.enum';

export interface SalesAccountResponseDto {
  id: string;
  code: string;
  name: string;
  companyId: string;
  branchId: string;
  employeeId: string | null;
  status: SalesAccountStatus;
  createdAt: Date;
  updatedAt: Date;
}

export function toSalesAccountResponseDto(
  account: SalesAccount,
): SalesAccountResponseDto {
  return {
    id: account.id,
    code: account.code,
    name: account.name,
    companyId: account.companyId,
    branchId: account.branchId,
    employeeId: account.employeeId,
    status: account.status,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}
