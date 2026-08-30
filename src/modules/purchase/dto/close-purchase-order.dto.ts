import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ClosePurchaseOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
