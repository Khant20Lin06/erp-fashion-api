import { IsEnum } from 'class-validator';
import { SupplierQuotationStatus } from '../entities/supplier-quotation-status.enum';

export class UpdateSupplierQuotationStatusDto {
  @IsEnum(SupplierQuotationStatus)
  status!: SupplierQuotationStatus;
}
