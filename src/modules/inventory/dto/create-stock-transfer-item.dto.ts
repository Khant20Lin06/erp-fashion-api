import { IsInt, IsUUID, Min } from 'class-validator';

export class CreateStockTransferItemDto {
  @IsUUID()
  productVariantId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}
