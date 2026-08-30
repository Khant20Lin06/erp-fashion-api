import { IsEnum } from 'class-validator';
import { PurchaseRequestStatus } from '../entities/purchase-request-status.enum';

export class UpdatePurchaseRequestStatusDto {
  @IsEnum(PurchaseRequestStatus)
  status!: PurchaseRequestStatus;
}
