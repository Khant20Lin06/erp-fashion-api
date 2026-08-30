import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { PayrollComponent } from '../entities/payroll-component.entity';
import { PayrollComponentType } from '../entities/payroll-component-type.enum';
import { PayrollCalculationType } from '../entities/payroll-calculation-type.enum';

const NON_NEGATIVE_DECIMAL_PATTERN = /^\d+(\.\d{1,2})?$/;
const PERCENTAGE_PATTERN = /^\d{1,3}(\.\d{1,4})?$/;

export class CreatePayrollComponentDto {
  @IsUUID()
  companyId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  code!: string;

  @IsEnum(PayrollComponentType)
  type!: PayrollComponentType;

  @IsEnum(PayrollCalculationType)
  calculationType!: PayrollCalculationType;

  @IsOptional()
  @Matches(NON_NEGATIVE_DECIMAL_PATTERN, {
    message: 'fixedAmount must be a non-negative decimal string',
  })
  fixedAmount?: string;

  @IsOptional()
  @Matches(PERCENTAGE_PATTERN, {
    message: 'percentage must be a non-negative decimal string (0-100)',
  })
  percentage?: string;

  @IsOptional()
  @IsBoolean()
  isTaxable?: boolean;
}

export class UpdatePayrollComponentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @Matches(NON_NEGATIVE_DECIMAL_PATTERN, {
    message: 'fixedAmount must be a non-negative decimal string',
  })
  fixedAmount?: string;

  @IsOptional()
  @Matches(PERCENTAGE_PATTERN, {
    message: 'percentage must be a non-negative decimal string (0-100)',
  })
  percentage?: string;

  @IsOptional()
  @IsBoolean()
  isTaxable?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListPayrollComponentsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsEnum(PayrollComponentType)
  type?: PayrollComponentType;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  search?: string;
}

export interface PayrollComponentResponseDto {
  id: string;
  companyId: string;
  name: string;
  code: string;
  type: PayrollComponentType;
  calculationType: PayrollCalculationType;
  fixedAmount: string | null;
  percentage: string | null;
  isTaxable: boolean;
  isActive: boolean;
  assignmentCount: number;
  historyCount: number;
  canDelete: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type PayrollComponentUsageDto = {
  assignmentCount: number;
  historyCount: number;
  canDelete: boolean;
};

export function toPayrollComponentResponseDto(
  component: PayrollComponent,
  usage?: PayrollComponentUsageDto,
): PayrollComponentResponseDto {
  return {
    id: component.id,
    companyId: component.companyId,
    name: component.name,
    code: component.code,
    type: component.type,
    calculationType: component.calculationType,
    fixedAmount: component.fixedAmount,
    percentage: component.percentage,
    isTaxable: component.isTaxable,
    isActive: component.isActive,
    assignmentCount: usage?.assignmentCount ?? 0,
    historyCount: usage?.historyCount ?? 0,
    canDelete: usage?.canDelete ?? true,
    createdAt: component.createdAt,
    updatedAt: component.updatedAt,
  };
}
