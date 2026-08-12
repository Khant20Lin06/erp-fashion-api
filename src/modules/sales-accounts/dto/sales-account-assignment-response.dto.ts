import { SalesAccountAssignment } from '../entities/sales-account-assignment.entity';
import { SalesAccountAssignmentStatus } from '../entities/sales-account-assignment-status.enum';

export interface SalesAccountAssignmentResponseDto {
  id: string;
  userId: string;
  employeeId: string;
  salesAccountId: string;
  status: SalesAccountAssignmentStatus;
  isPrimary: boolean;
  assignedAt: Date;
  unassignedAt: Date | null;
}

export function toSalesAccountAssignmentResponseDto(
  assignment: SalesAccountAssignment,
): SalesAccountAssignmentResponseDto {
  return {
    id: assignment.id,
    userId: assignment.userId,
    employeeId: assignment.employeeId,
    salesAccountId: assignment.salesAccountId,
    status: assignment.status,
    isPrimary: assignment.isPrimary,
    assignedAt: assignment.assignedAt,
    unassignedAt: assignment.unassignedAt,
  };
}
