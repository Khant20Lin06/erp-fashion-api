import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * `code`, `companyId`, `branchId` are deliberately absent — immutable after
 * creation, matching the Company/Branch/Warehouse pattern (Phase 07 §64).
 * `employeeId` ownership is changed via SalesAccountAssignment, not a PATCH.
 */
export class UpdateSalesAccountDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;
}
