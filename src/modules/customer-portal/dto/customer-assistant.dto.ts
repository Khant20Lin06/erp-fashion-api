import { IsObject, IsUUID } from 'class-validator';

export class CustomerAssistantDto {
  @IsUUID() companyId!: string;
  @IsObject() update!: Record<string, unknown>;
  @IsUUID() operationToken!: string;
}
