import { IsNotEmpty, IsNumberString, IsOptional, IsString } from 'class-validator';

export class ClosePosShiftDto {
  @IsNumberString()
  @IsNotEmpty()
  actualCash!: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
