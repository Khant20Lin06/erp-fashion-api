import { IsUUID } from 'class-validator';

export class AssignSalesAccountDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  employeeId!: string;
}
