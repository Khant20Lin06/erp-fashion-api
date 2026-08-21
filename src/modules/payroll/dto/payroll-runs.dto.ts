import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { PayrollRun } from '../entities/payroll-run.entity';
import { PayrollRunStatus } from '../entities/payroll-run-status.enum';
import { PayrollRunEmployee } from '../entities/payroll-run-employee.entity';
import { PayrollRunEmployeeStatus } from '../entities/payroll-run-employee-status.enum';
import { PayrollRunEmployeeItem } from '../entities/payroll-run-employee-item.entity';
import { PayrollComponentType } from '../entities/payroll-component-type.enum';
import { PayrollCalculationType } from '../entities/payroll-calculation-type.enum';

export class CreatePayrollRunDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  payrollPeriodId!: string;
}

export class ListPayrollRunsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  payrollPeriodId?: string;

  @IsOptional()
  @IsEnum(PayrollRunStatus)
  status?: PayrollRunStatus;
}

export interface PayrollRunResponseDto {
  id: string;
  companyId: string;
  payrollPeriodId: string;
  runNumber: string;
  status: PayrollRunStatus;
  employeeCount: number;
  totalGrossPay: string;
  totalDeductions: string;
  totalNetPay: string;
  startedAt: Date | null;
  completedAt: Date | null;
  finalizedAt: Date | null;
  createdBy: string;
  finalizedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toPayrollRunResponseDto(
  run: PayrollRun,
): PayrollRunResponseDto {
  return {
    id: run.id,
    companyId: run.companyId,
    payrollPeriodId: run.payrollPeriodId,
    runNumber: run.runNumber,
    status: run.status,
    employeeCount: run.employeeCount,
    totalGrossPay: run.totalGrossPay,
    totalDeductions: run.totalDeductions,
    totalNetPay: run.totalNetPay,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    finalizedAt: run.finalizedAt,
    createdBy: run.createdBy,
    finalizedBy: run.finalizedBy,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  };
}

export interface PayrollRunEmployeeItemResponseDto {
  id: string;
  payrollComponentId: string | null;
  componentNameSnapshot: string;
  componentCodeSnapshot: string;
  type: PayrollComponentType;
  calculationTypeSnapshot: PayrollCalculationType;
  amount: string;
}

export function toPayrollRunEmployeeItemResponseDto(
  item: PayrollRunEmployeeItem,
): PayrollRunEmployeeItemResponseDto {
  return {
    id: item.id,
    payrollComponentId: item.payrollComponentId,
    componentNameSnapshot: item.componentNameSnapshot,
    componentCodeSnapshot: item.componentCodeSnapshot,
    type: item.type,
    calculationTypeSnapshot: item.calculationTypeSnapshot,
    amount: item.amount,
  };
}

export interface PayrollRunEmployeeResponseDto {
  id: string;
  payrollRunId: string;
  employeeId: string;
  employeeCodeSnapshot: string;
  employeeNameSnapshot: string;
  departmentSnapshot: string | null;
  designationSnapshot: string | null;
  baseSalarySnapshot: string;
  grossPay: string;
  totalDeductions: string;
  netPay: string;
  status: PayrollRunEmployeeStatus;
  items?: PayrollRunEmployeeItemResponseDto[];
}

export function toPayrollRunEmployeeResponseDto(
  payslip: PayrollRunEmployee,
  items?: PayrollRunEmployeeItem[],
): PayrollRunEmployeeResponseDto {
  return {
    id: payslip.id,
    payrollRunId: payslip.payrollRunId,
    employeeId: payslip.employeeId,
    employeeCodeSnapshot: payslip.employeeCodeSnapshot,
    employeeNameSnapshot: payslip.employeeNameSnapshot,
    departmentSnapshot: payslip.departmentSnapshot,
    designationSnapshot: payslip.designationSnapshot,
    baseSalarySnapshot: payslip.baseSalarySnapshot,
    grossPay: payslip.grossPay,
    totalDeductions: payslip.totalDeductions,
    netPay: payslip.netPay,
    status: payslip.status,
    items: items?.map(toPayrollRunEmployeeItemResponseDto),
  };
}
