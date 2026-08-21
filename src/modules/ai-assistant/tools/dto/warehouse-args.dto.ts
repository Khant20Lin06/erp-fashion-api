import { IsOptional, IsUUID } from 'class-validator';

export class WarehouseArgsDto {
  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}
