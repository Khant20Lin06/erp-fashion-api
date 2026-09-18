import { Type } from 'class-transformer';
import {
  Allow,
  IsInt,
  IsBoolean,
  IsObject,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ShoppingApiResponseDto {
  @IsInt() @Min(0) @Max(599) statusCode!: number;
  @Allow() body?: unknown;
}
export class ShoppingStepDto {
  @IsOptional() @IsBoolean() assistantEnabled?: boolean;
  @IsUUID() companyId!: string;
  @IsObject() update!: Record<string, unknown>;
  @IsOptional() @IsUUID() operationToken?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => ShoppingApiResponseDto)
  response?: ShoppingApiResponseDto;
}
