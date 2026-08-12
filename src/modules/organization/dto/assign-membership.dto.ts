import { IsUUID } from 'class-validator';

export class AssignCompanyMembershipDto {
  @IsUUID()
  companyId!: string;
}

export class AssignBranchMembershipDto {
  @IsUUID()
  branchId!: string;
}

export class AssignWarehouseMembershipDto {
  @IsUUID()
  warehouseId!: string;
}
