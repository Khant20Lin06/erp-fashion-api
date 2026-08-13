import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { PaymentTermStatus } from '../entities/payment-term-status.enum';

export class ListPaymentTermsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsEnum(PaymentTermStatus)
  status?: PaymentTermStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
