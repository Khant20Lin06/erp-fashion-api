import { Branch } from '../entities/branch.entity';
import { BranchStatus } from '../entities/branch-status.enum';

export interface BranchResponseDto {
  id: string;
  companyId: string;
  code: string;
  name: string;
  status: BranchStatus;
  phone: string | null;
  email: string | null;
  address: string | null;
  timezone: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toBranchResponseDto(branch: Branch): BranchResponseDto {
  return {
    id: branch.id,
    companyId: branch.companyId,
    code: branch.code,
    name: branch.name,
    status: branch.status,
    phone: branch.phone,
    email: branch.email,
    address: branch.address,
    timezone: branch.timezone,
    createdAt: branch.createdAt,
    updatedAt: branch.updatedAt,
  };
}
