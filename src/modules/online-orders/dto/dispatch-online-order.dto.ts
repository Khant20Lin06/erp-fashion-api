import { IsNotEmpty, IsNumberString, IsOptional, IsString } from 'class-validator';

export class DispatchOnlineOrderDto {
  @IsString()
  @IsNotEmpty()
  courierService!: string;

  @IsString()
  @IsOptional()
  trackingNumber?: string;

  @IsNumberString()
  @IsOptional()
  codAmount?: string;

  @IsString()
  @IsOptional()
  riderName?: string;

  @IsString()
  @IsOptional()
  riderPhone?: string;
}
