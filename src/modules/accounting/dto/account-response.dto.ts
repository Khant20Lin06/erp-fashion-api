import { Account } from '../entities/account.entity';
import { AccountType } from '../entities/account-type.enum';

export interface AccountResponseDto {
  id: string;
  companyId: string;
  parentId: string | null;
  code: string;
  name: string;
  accountType: AccountType;
  isActive: boolean;
  isSystemAccount: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toAccountResponseDto(account: Account): AccountResponseDto {
  return {
    id: account.id,
    companyId: account.companyId,
    parentId: account.parentId,
    code: account.code,
    name: account.name,
    accountType: account.accountType,
    isActive: account.isActive,
    isSystemAccount: account.isSystemAccount,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}
