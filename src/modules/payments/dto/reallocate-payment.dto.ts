import { ArrayMinSize, IsArray, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreatePaymentAllocationDto } from './create-payment-allocation.dto';

export class ReallocatePaymentDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePaymentAllocationDto)
  allocations!: CreatePaymentAllocationDto[];
}
