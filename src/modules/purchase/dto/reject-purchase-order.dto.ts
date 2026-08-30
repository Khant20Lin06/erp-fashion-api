import { IsString, MaxLength } from 'class-validator';

export class RejectPurchaseOrderDto {
  @IsString()
  @MaxLength(500)
  reason!: string;
}
