import { IsInt, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreatePurchaseRequestItemDto {
  @IsUUID()
  productVariantId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsString()
  @MaxLength(255)
  reason!: string;
}
