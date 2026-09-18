import { IsNotEmpty, IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';

export class OpenPosShiftDto {
  @IsUUID()
  @IsNotEmpty()
  branchId!: string;

  @IsNumberString()
  @IsOptional()
  openingCash?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
