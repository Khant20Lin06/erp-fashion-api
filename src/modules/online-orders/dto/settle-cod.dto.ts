import { IsNotEmpty, IsNumberString, IsOptional, IsString } from 'class-validator';

export class SettleCodDto {
  @IsNumberString()
  @IsNotEmpty()
  collectedAmount!: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
