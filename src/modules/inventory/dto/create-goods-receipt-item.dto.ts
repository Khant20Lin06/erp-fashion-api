import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateGoodsReceiptItemDto {
  @IsUUID()
  purchaseOrderItemId!: string;

  @IsUUID()
  productVariantId!: string;

  @IsInt()
  @Min(0)
  receivedQuantity!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  rejectedQuantity?: number;
}
