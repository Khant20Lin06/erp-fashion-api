import { Employee } from '../entities/employee.entity';
import { EmployeeStatus } from '../entities/employee-status.enum';
import type { EmployeeWithCurrentAssignment } from '../services/employees.service';

export interface EmployeeResponseDto {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  displayName: string;
  phone: string | null;
  email: string | null;
  dateOfBirth: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  userId: string | null;
  companyId: string;
  branchId: string;
  status: EmployeeStatus;
  joinedAt: Date | null;
  terminatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  assignmentId?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  designationId?: string | null;
  designationName?: string | null;
  branchName?: string | null;
  assignmentEffectiveFrom?: string | null;
}

type EmployeeResponseSource = Employee & Partial<EmployeeWithCurrentAssignment>;

export function toEmployeeResponseDto(
  employee: EmployeeResponseSource,
): EmployeeResponseDto {
  return {
    id: employee.id,
    employeeCode: employee.employeeCode,
    firstName: employee.firstName,
    lastName: employee.lastName,
    displayName: employee.displayName,
    phone: employee.phone,
    email: employee.email,
    dateOfBirth: employee.dateOfBirth,
    address: employee.address,
    emergencyContactName: employee.emergencyContactName,
    emergencyContactPhone: employee.emergencyContactPhone,
    userId: employee.userId,
    companyId: employee.companyId,
    branchId: employee.branchId,
    status: employee.status,
    joinedAt: employee.joinedAt,
    terminatedAt: employee.terminatedAt,
    createdAt: employee.createdAt,
    updatedAt: employee.updatedAt,
    assignmentId: employee.assignmentId ?? null,
    departmentId: employee.departmentId ?? null,
    departmentName: employee.departmentName ?? null,
    designationId: employee.designationId ?? null,
    designationName: employee.designationName ?? null,
    branchName: employee.branchName ?? null,
    assignmentEffectiveFrom: employee.assignmentEffectiveFrom ?? null,
  };
}
