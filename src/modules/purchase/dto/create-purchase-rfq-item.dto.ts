import { IsInt, IsString, IsUUID, Min } from 'class-validator';

export class CreatePurchaseRfqItemDto {
  @IsUUID()
  productVariantId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsString()
  reason!: string;
}
