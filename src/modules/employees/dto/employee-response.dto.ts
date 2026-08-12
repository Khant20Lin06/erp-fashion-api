import { Employee } from '../entities/employee.entity';
import { EmployeeStatus } from '../entities/employee-status.enum';

export interface EmployeeResponseDto {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  displayName: string;
  phone: string | null;
  email: string | null;
  userId: string | null;
  companyId: string;
  branchId: string;
  status: EmployeeStatus;
  joinedAt: Date | null;
  terminatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toEmployeeResponseDto(employee: Employee): EmployeeResponseDto {
  return {
    id: employee.id,
    employeeCode: employee.employeeCode,
    firstName: employee.firstName,
    lastName: employee.lastName,
    displayName: employee.displayName,
    phone: employee.phone,
    email: employee.email,
    userId: employee.userId,
    companyId: employee.companyId,
    branchId: employee.branchId,
    status: employee.status,
    joinedAt: employee.joinedAt,
    terminatedAt: employee.terminatedAt,
    createdAt: employee.createdAt,
    updatedAt: employee.updatedAt,
  };
}
