import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateGoodsReceiptItemDto {
  @IsUUID()
  purchaseOrderItemId!: string;

  @IsUUID()
  productVariantId!: string;

  @IsInt()
  @Min(1)
  receivedQuantity!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  rejectedQuantity?: number;
}
