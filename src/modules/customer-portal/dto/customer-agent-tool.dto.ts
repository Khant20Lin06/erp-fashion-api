import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CustomerAgentToolDto {
  @IsUUID() companyId!: string;
  @IsObject() update!: Record<string, unknown>;
  @IsUUID() operationToken!: string;
  @IsIn(['search', 'detail', 'policy', 'orders', 'popular'])
  tool!: 'search' | 'detail' | 'policy' | 'orders' | 'popular';
  @IsOptional() @IsString() @MaxLength(100) query?: string;
  @IsOptional() @IsUUID() productId?: string;
}
