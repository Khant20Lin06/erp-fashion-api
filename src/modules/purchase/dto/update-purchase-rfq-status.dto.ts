import { IsEnum } from 'class-validator';
import { PurchaseRfqStatus } from '../entities/purchase-rfq-status.enum';

export class UpdatePurchaseRfqStatusDto {
  @IsEnum(PurchaseRfqStatus)
  status!: PurchaseRfqStatus;
}
