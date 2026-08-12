import { UserCompany } from '../entities/user-company.entity';
import { UserBranch } from '../entities/user-branch.entity';
import { UserWarehouse } from '../entities/user-warehouse.entity';
import { MembershipStatus } from '../entities/membership-status.enum';

export interface CompanyMembershipResponseDto {
  id: string;
  userId: string;
  companyId: string;
  status: MembershipStatus;
  isPrimary: boolean;
  createdAt: Date;
}

export interface BranchMembershipResponseDto {
  id: string;
  userId: string;
  branchId: string;
  status: MembershipStatus;
  isPrimary: boolean;
  createdAt: Date;
}

export interface WarehouseMembershipResponseDto {
  id: string;
  userId: string;
  warehouseId: string;
  status: MembershipStatus;
  isPrimary: boolean;
  createdAt: Date;
}

export function toCompanyMembershipResponseDto(
  membership: UserCompany,
): CompanyMembershipResponseDto {
  return {
    id: membership.id,
    userId: membership.userId,
    companyId: membership.companyId,
    status: membership.status,
    isPrimary: membership.isPrimary,
    createdAt: membership.createdAt,
  };
}

export function toBranchMembershipResponseDto(
  membership: UserBranch,
): BranchMembershipResponseDto {
  return {
    id: membership.id,
    userId: membership.userId,
    branchId: membership.branchId,
    status: membership.status,
    isPrimary: membership.isPrimary,
    createdAt: membership.createdAt,
  };
}

export function toWarehouseMembershipResponseDto(
  membership: UserWarehouse,
): WarehouseMembershipResponseDto {
  return {
    id: membership.id,
    userId: membership.userId,
    warehouseId: membership.warehouseId,
    status: membership.status,
    isPrimary: membership.isPrimary,
    createdAt: membership.createdAt,
  };
}
