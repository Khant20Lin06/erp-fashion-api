import { IsInt, IsUUID, Min } from 'class-validator';

export class CreateBranchTransferItemDto {
  @IsUUID()
  productVariantId!: string;

  @IsInt()
  @Min(1)
  requestedQuantity!: number;
}
